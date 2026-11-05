import { createHash } from 'node:crypto'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { type CommentSyntax, codeState, type ScanState, scanCodeLine, syntaxForPath, syntaxRules } from './scanCodeLineFn.ts'

/* The `.ts` on that import is load-bearing, not a slip: verify-reuse-gate.mjs imports this module and node
resolves a relative import only with an explicit extension, where our tsconfig omits it
(allowImportingTsExtensions is what keeps tsc happy with it). scanCodeLineFn imports nothing of its own, so
the hook can load the pair - add a second relative import here and every repo that lacks that file loses
`pnpm commit` entirely, which is how prequel-project lost it once already. */

const verificationScripts = [
	'scoped-quality',
	'quality',
	'run-tests',
	'fleet-verify',
	'typecheck',
	'periodic',
	'unit',
	'e2e',
	'tc6',
	'tc7',
	'test',
]

const verificationPattern = new RegExp(`(^|[\\s;&|])pnpm\\s+(run\\s+)?(${verificationScripts.join('|')})(\\s|$)`)

export function commandIsVerification({ command }: { command: string }): boolean {
	return verificationPattern.test(command)
}

const commitAttemptPattern = /(^|[\s;&|])pnpm\s+(run\s+)?(commit|fleet-sync)(\s|$)/
const gitInspectionPattern = /(^|[\s;&|])git\s+(status|diff|log|show)(\s|$)/

/* The commit retry is the way out of an armed gate, so refusing it would trap the agent. Read-only git is
here for one reason: `pnpm commit` also aborts on a path with no changes, and an agent with no code edit to
make would otherwise have no command that can diagnose that and none that can disarm the gate. Raw
`git commit` is deliberately NOT here - commit-entry-point.mjs refuses it anyway. */
export function commandPassesArmedGate({ command }: { command: string }): boolean {
	return commitAttemptPattern.test(command) || gitInspectionPattern.test(command)
}

/* Strips the comment SPANS and keeps the code either side, so a block comment sitting between two
operands cannot take the operand after it with it - truncate at the comment instead and the operand is
dropped from the fingerprint, where a later edit to it would then move behaviour without disarming the
gate, which is the one outcome this cannot produce. Whitespace before a removed span goes too, so deleting
the comment by hand leaves exactly the text the strip already produced. Driven off scanCodeLine rather
than a line-opener regex because the brevity gate flags trailing comments on that same scanner: match them
with a regex instead and every https:// inside a string reports as a comment, and matching line-openers
alone is what let a trimmed trailing comment disarm the gate silently. */
function stripLine({ line, state, syntax }: { line: string; state: ScanState; syntax: CommentSyntax }): {
	code: string
	state: ScanState
} {
	const block = syntaxRules[syntax].block
	let remaining = line
	let current = state
	let code = ''

	while (remaining !== '') {
		if (current.kind === 'block') {
			if (block === undefined) return { code, state: current }
			const closeAt = remaining.indexOf(block.close)
			if (closeAt === -1) return { code, state: current }
			remaining = remaining.slice(closeAt + block.close.length)
			current = codeState
			continue
		}

		const scanned = scanCodeLine({ line: remaining, state: current, syntax })
		if (scanned.commentStart === undefined) return { code: code + remaining, state: scanned.state }

		code += remaining.slice(0, scanned.commentStart).trimEnd()

		if (block === undefined || !remaining.startsWith(block.open, scanned.commentStart)) {
			return { code, state: scanned.state }
		}

		const closeAt = remaining.indexOf(block.close, scanned.commentStart + block.open.length)
		if (closeAt === -1) return { code, state: { kind: 'block' } }
		remaining = remaining.slice(closeAt + block.close.length)
		current = codeState
	}
	return { code, state: current }
}

export function stripToCode({ path, contents }: { path: string; contents: string }): string {
	const syntax = syntaxForPath({ path })
	const kept: string[] = []
	let state: ScanState = codeState

	for (const raw of contents.split('\n')) {
		let line = raw.trim()
		if (syntax !== undefined) {
			const stripped = stripLine({ line: raw, state, syntax })
			state = stripped.state
			line = stripped.code.trim()
		}
		if (line !== '') kept.push(line)
	}
	return kept.join('\n')
}

export function codeFingerprint({ paths }: { paths: ReadonlyArray<string> }): string {
	const parts = paths.map((path) => {
		const contents = existsSync(path) ? readFileSync(path, 'utf8') : ''
		return `${path}\n${stripToCode({ path, contents })}`
	})
	return createHash('sha1').update(parts.join('\n')).digest('hex')
}

const leadingCdPattern = /^\s*cd\s+([^&;|]+)/

/* The trim marker holds the paths relative to the cwd `pnpm commit` ran in, so a hook left standing
somewhere else fingerprints different files and disarms without saying so - which is how every commit made
into a peer fleet repo escaped this gate. `.cwd` is where Claude stands BEFORE the command runs, so a `cd`
inside the command itself outranks it. */
export function resolveHookCwd({ command, cwd }: { command: string; cwd: string | undefined }): string {
	let base = process.env['CLAUDE_PROJECT_DIR'] ?? '.'
	if (cwd !== undefined && cwd !== '') base = cwd

	const match = command.match(leadingCdPattern)
	if (match === null) return base

	let target = match[1]
	if (target === undefined) return base
	target = target.trim()
	if (target.startsWith('"') || target.startsWith("'")) target = target.slice(1)
	if (target.endsWith('"') || target.endsWith("'")) target = target.slice(0, -1)
	if (target === '') return base

	return resolve(base, target)
}

export function sessionMarkerPath({ kind }: { kind: string }): string {
	return join(tmpdir(), `brevity-${kind}-${process.env['CLAUDE_CODE_SESSION_ID'] ?? 'nosession'}.txt`)
}

const markerPath = sessionMarkerPath

export function recordVerificationRun(): void {
	writeFileSync(markerPath({ kind: 'verified' }), '')
}

export function hasVerificationRun(): boolean {
	return existsSync(markerPath({ kind: 'verified' }))
}

/* Skipped when nothing has verified this session: an agent whose first commit attempt is denied must not
then be refused the first verification it ever runs. */
export function armTrimMarker({ paths }: { paths: ReadonlyArray<string> }): void {
	if (!hasVerificationRun()) return
	writeFileSync(markerPath({ kind: 'trim' }), [codeFingerprint({ paths }), ...paths].join('\n'))
}

export function clearTrimMarker(): void {
	rmSync(markerPath({ kind: 'trim' }), { force: true })
}

export function readTrimMarker(): { paths: string[] } | undefined {
	const path = markerPath({ kind: 'trim' })
	if (!existsSync(path)) return undefined
	const [expected, ...paths] = readFileSync(path, 'utf8')
		.split('\n')
		.filter((line) => line !== '')
	if (expected === undefined || paths.length === 0) return undefined
	return codeFingerprint({ paths }) === expected ? { paths } : undefined
}
