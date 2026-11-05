import { spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, readFileSync, statSync } from 'node:fs'
import { addS } from './textUtilities.ts'
import { type AddedComment, type AddedComments, commentVerdicts, findAddedComments, parseAddedLines } from './brevityGateFn.ts'
import { auditableExtensions } from './scanCodeLineFn.ts'
import { armTrimMarker, clearTrimMarker, sessionMarkerPath } from './verificationMarker.ts'

/* Carried in the refusal itself, not left to verify-reuse-gate.mjs. Dropping it on the grounds that the
hook enforced it is what put the fleet back on a trim-then-re-verify cycle for a month: the hook has four
preconditions that each fail silently, and this paragraph has none. */
const noReverify = `Do not re-run anything after deleting these lines - not pnpm quality, tc6, tc7, scoped-quality, run-tests, unit or fleet-verify, and not anything else either. Those are the usual suspects, not an exhaustive list. Delete, then go straight back to the same commit.`

function git(args: ReadonlyArray<string>): string {
	const result = spawnSync('git', [...args], { encoding: 'utf8' })
	if ((result.status ?? 1) !== 0) throw new Error(`git ${args.join(' ')} failed`)
	return result.stdout ?? ''
}

function isTracked({ path }: { path: string }): boolean {
	return (spawnSync('git', ['ls-files', '--error-unmatch', path], { encoding: 'utf8' }).status ?? 1) === 0
}

function readContents({ path }: { path: string }): string {
	return existsSync(path) ? readFileSync(path, 'utf8') : ''
}

/* `pnpm commit wp-content/mu-plugins` is a legal pathspec, and the extension filter below matches a
directory against nothing - so every comment under a directory argument committed unread. Expanded with
the same two listings `git add` stages, which is what keeps the audited set equal to the committed one. */
function expandDirectories({ paths }: { paths: ReadonlyArray<string> }): ReadonlyArray<string> {
	return paths.flatMap((path) => {
		if (!existsSync(path) || !statSync(path).isDirectory()) return [path]

		const listed = ['ls-files', '--cached', '--others', '--exclude-standard', '--', path]
		return git(listed)
			.split('\n')
			.filter((line) => line !== '')
	})
}

function addedLineNumbers({ path, contents }: { path: string; contents: string }): Set<number> {
	if (isTracked({ path })) {
		return new Set(parseAddedLines({ diff: git(['diff', 'HEAD', '-U0', '--', path]) }).map((added) => added.line))
	}
	return new Set(contents.split('\n').map((_line, index) => index + 1))
}

/* The key carries no line number: trimming one comment renumbers every line below it, so a line-keyed
entry would never match its own retry and the gate would loop instead of converging. */
function shownKey(comment: AddedComment): string {
	return `${comment.file}: ${comment.text}`
}

function takeFresh({ kind, comments }: { kind: string; comments: ReadonlyArray<AddedComment> }): AddedComment[] {
	if (comments.length === 0) return []
	const path = sessionMarkerPath({ kind })
	const shown = existsSync(path) ? new Set(readFileSync(path, 'utf8').split('\n')) : new Set<string>()
	const fresh = comments.filter((comment) => !shown.has(shownKey(comment)))
	appendFileSync(path, `${comments.map(shownKey).join('\n')}\n`)
	return fresh
}

function listOf(comments: ReadonlyArray<AddedComment>): string {
	return comments.map((comment) => `${comment.file}:${comment.line}  ${comment.text}`).join('\n')
}

/* Any git or marker-file failure returns undefined rather than throwing, so a gate that cannot read the
tree lets the commit through. A gate broken by a missing TMPDIR would otherwise block every commit in a
shared working tree, which is worse than the prose it exists to catch. */
export function auditCommitComments({ paths }: { paths: ReadonlyArray<string> }): string | undefined {
	try {
		const audited = expandDirectories({ paths }).filter((path) => auditableExtensions.some((extension) => path.endsWith(extension)))
		if (audited.length === 0) return undefined

		const found: AddedComments = { prose: [], sealed: [], sql: [] }
		for (const path of audited) {
			const contents = readContents({ path })
			const comments = findAddedComments({ file: path, contents, addedLines: addedLineNumbers({ path, contents }) })
			for (const verdict of commentVerdicts) found[verdict].push(...comments[verdict])
		}

		const freshProse = takeFresh({ kind: 'gate', comments: found.prose })
		const freshSealed = takeFresh({ kind: 'sealed', comments: found.sealed })
		if (freshProse.length === 0 && freshSealed.length === 0 && found.sql.length === 0) {
			clearTrimMarker()
			return undefined
		}

		const parts: string[] = []
		if (found.sql.length > 0) {
			parts.push(
				`${found.sql.length} comment line${addS(found.sql)} in a migration`,
				'',
				listOf(found.sql),
				'',
				'Only a full-line -- squawk-ignore <rule> is legal. fleet-hq/docs/db/migrations-guide.md',
			)
		}
		if (freshProse.length > 0) {
			if (parts.length > 0) parts.push('')
			parts.push(
				`${freshProse.length} comment line${addS(freshProse)} added`,
				'',
				listOf(freshProse),
				'',
				'Gate 2 - name the edit each one prevents and what breaks without it, or delete it. ../fleet-hq/docs/brevity-guide.md',
			)
		}
		if (freshSealed.length > 0) {
			if (parts.length > 0) parts.push('')
			parts.push(
				`${freshSealed.length} comment${addS(freshSealed)} proposed for Dan to seal`,
				'',
				listOf(freshSealed),
				'',
				'Keep as written and name in your report.',
			)
		}

		if (found.sql.length > 0 || freshProse.length > 0) parts.push('', noReverify)

		armTrimMarker({ paths: audited })
		return parts.join('\n')
	} catch {
		return undefined
	}
}
