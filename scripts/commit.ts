import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { auditCommitComments } from './brevityGate.ts'
import { commitTitleRefusal } from './commitTitleFn.ts'
import { logger } from './logger.ts'
import { addS } from './textUtilities.ts'

/* `pnpm commit "<description>" <path> [path...]` - per-path committing without the git pathspec
footguns. It stages and commits only the paths named, refuses to run with none, and fails loudly on a
path with no change so a typo aborts rather than committing a subset. Push stays a separate step.

Flattened from the fleet's scripts/scriptsFleet/commit.ts: the runScript wrapper, the --run token and
the agentOutcome exit codes are machinery for sharing one script across eleven repos, and this repo has
no second caller to share it with. */

function git(args: ReadonlyArray<string>): { code: number; stdout: string; stderr: string } {
	const result = spawnSync('git', [...args], { encoding: 'utf8' })
	return { code: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
}

function gitOrThrow(args: ReadonlyArray<string>): string {
	const { code, stdout, stderr } = git(args)
	if (code !== 0) throw new Error(`git ${args.join(' ')} failed:\n${stderr || stdout}`)
	return stdout
}

const biomeExtensions = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.json', '.jsonc', '.css']

/* Runs after the no-change check so a mistyped path reports rather than being formatted into a real
change, and before the brevity gate, which counts added comment lines - a rewrap afterwards would commit
text the gate never read. */
function formatPaths(paths: ReadonlyArray<string>): void {
	const formattable = paths.filter((path) => biomeExtensions.some((suffix) => path.endsWith(suffix)) && existsSync(path))
	if (formattable.length === 0) return

	const result = spawnSync('pnpm', ['exec', 'biome', 'check', '--write', '--unsafe', ...formattable], { encoding: 'utf8' })
	const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
	const fixed = Number(output.match(/Fixed (\d+) file/)?.[1] ?? 0)
	if (fixed > 0) logger.info(`Formatted ${fixed} file${addS(fixed)}`)
}

function run(): void {
	const description = process.argv[2]?.trim()
	const paths = process.argv.slice(3).filter((argument) => argument.trim() !== '')

	if (description === undefined || description === '') {
		throw new Error('Usage: pnpm commit "<description>" <path> [path...] - a description is required.')
	}

	const titleRefusal = commitTitleRefusal({ title: description })
	if (titleRefusal !== undefined) throw new Error(titleRefusal)

	if (paths.length === 0) {
		throw new Error('Usage: pnpm commit "<description>" <path> [path...] - name the exact paths (this never commits everything).')
	}

	const unchanged = paths.filter((path) => gitOrThrow(['status', '--porcelain', '--', path]).trim() === '')
	if (unchanged.length > 0) {
		throw new Error(
			`No change to commit for ${unchanged.length} path${addS(unchanged)}:\n${unchanged.map((path) => `  ${path}`).join('\n')}`,
		)
	}

	formatPaths(paths)

	const refusal = auditCommitComments({ paths })
	if (refusal !== undefined) throw new Error(refusal)

	/* A path whose change is already fully staged - most often a `git rm`'d deletion, which leaves
	nothing for the pathspec to match in either the tree or the index - makes `git add` fail. That is not
	a real error, so it is swallowed only when porcelain shows a staged change for that path. */
	for (const path of paths) {
		const { code, stderr } = git(['add', '--', path])
		if (code === 0) continue
		const indexStatus = gitOrThrow(['status', '--porcelain', '--', path])[0]
		const alreadyStaged = indexStatus !== undefined && indexStatus !== ' ' && indexStatus !== '?'
		if (!alreadyStaged) throw new Error(`git add -- ${path} failed:\n${stderr}`)
	}
	gitOrThrow(['commit', '-m', description, '--', ...paths])

	const hash = gitOrThrow(['rev-parse', '--short', 'HEAD']).trim()
	const branch = gitOrThrow(['rev-parse', '--abbrev-ref', 'HEAD']).trim()
	const committed = gitOrThrow(['show', '--stat', '--oneline', 'HEAD']).trimEnd()

	logger.info(`Committed ${paths.length} path${addS(paths)} as ${hash} on ${branch} (not pushed)\n\n${committed}`)
}

try {
	run()
} catch (error) {
	logger.error(error instanceof Error ? error.message : String(error))
	process.exit(1)
}

/*
pnpm commit "<description>" <path> [path...]
*/
