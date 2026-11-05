import { type CommentSyntax, codeState, type ScanState, scanCodeLine, syntaxForPath, syntaxRules } from './scanCodeLineFn.ts'

export const commentVerdicts = ['prose', 'sealed', 'sql'] as const
export type CommentVerdict = (typeof commentVerdicts)[number]

export type AddedLine = { line: number; text: string }
export type AddedComment = { file: string; line: number; text: string }
export type AddedComments = Record<CommentVerdict, AddedComment[]>

export const commentDirectives = [
	'locked:',
	'cspell:',
	'biome-ignore',
	'eslint-disable',
	'eslint-enable',
	'prettier-ignore',
	'@ts-expect-error',
	'@ts-ignore',
	'@ts-nocheck',
	'v8 ignore',
	'c8 ignore',
	'@vitest-environment',
	'@type',
	'@param',
	'@returns',
	'shellcheck',
	'nolint',
	'go:',
] as const
export type CommentDirective = (typeof commentDirectives)[number]

/* WordPress reads these out of the docblock heading a plugin, an mu-plugin or a theme stylesheet, so they
are the file's own metadata and not prose. Trim `Plugin Name` and the plugin stops being a plugin; trim
`Template` and the child theme stops inheriting. */
export const fileHeaderFields = [
	'Author',
	'Author URI',
	'Description',
	'Domain Path',
	'License',
	'License URI',
	'Network',
	'Plugin Name',
	'Plugin URI',
	'Requires at least',
	'Requires PHP',
	'Tags',
	'Template',
	'Tested up to',
	'Text Domain',
	'Theme Name',
	'Theme URI',
	'Update URI',
	'Version',
] as const
export type FileHeaderField = (typeof fileHeaderFields)[number]

function escapeForPattern(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const directiveAlternation = commentDirectives.map(escapeForPattern).join('|')
/* `\*+` sits last so a `/*` form still wins the alternation. It is what lets the gate read the
continuation lines of a docblock, which carry their marker as a bare `*` rather than an opener. */
const proseMarkerGroup = '(\\/\\/+|\\/\\*+|\\{\\/\\*+|<!--|--|#|\\*+)'
const proseMarkers = `${proseMarkerGroup}[* ]*`
const sqlMarkers = '(--|\\/\\*+)[* ]*'

const proseDirectivePattern = new RegExp(`^${proseMarkers}(${directiveAlternation})`, 'i')
const sqlDirectivePattern = new RegExp(`^${sqlMarkers}(${directiveAlternation})`, 'i')
const sealedPattern = new RegExp(`^${proseMarkers}sealed:`, 'i')
const fileHeaderAlternation = fileHeaderFields.map(escapeForPattern).join('|')
/* The marker is optional here alone: a theme stylesheet writes its fields as bare lines inside the
block, with no `*` down the margin, so a required marker would exempt the plugin header and not that. */
const fileHeaderPattern = new RegExp(`^(?:${proseMarkerGroup})?[* ]*(${fileHeaderAlternation}) *:`, 'i')

const squawkIgnorePattern = /^-- *squawk-ignore /i
// Drizzle's own statement separator, not prose - the gate would otherwise fail every migration it writes.
const statementBreakpointPattern = /^-->/
const shebangPattern = /^#!/
const testFooterPattern = /^pnpm [a-z]/i
const hunkHeaderPattern = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/

export function parseAddedLines({ diff }: { diff: string }): AddedLine[] {
	const added: AddedLine[] = []
	let nextLine = 0

	for (const raw of diff.split('\n')) {
		const headerStart = raw.match(hunkHeaderPattern)?.[1]
		if (headerStart !== undefined) {
			nextLine = Number(headerStart)
			continue
		}
		if (raw.startsWith('+++')) continue
		if (raw.startsWith('+')) {
			added.push({ line: nextLine, text: raw.slice(1) })
			nextLine += 1
			continue
		}
		if (raw.startsWith(' ')) nextLine += 1
	}
	return added
}

function classifyComment({ text, syntax }: { text: string; syntax: CommentSyntax }): CommentVerdict | undefined {
	if (syntax === 'sql') {
		if (statementBreakpointPattern.test(text)) return undefined
		if (squawkIgnorePattern.test(text)) return undefined
		if (sqlDirectivePattern.test(text)) return undefined
		return 'sql'
	}
	if (shebangPattern.test(text)) return undefined
	if (proseDirectivePattern.test(text)) return undefined
	if (fileHeaderPattern.test(text)) return undefined
	if (testFooterPattern.test(text)) return undefined
	if (syntaxRules[syntax].lineOpeners.includes(text.trim())) return undefined
	/* Split out rather than added to commentDirectives: this is the one marker an agent may write, so
	listing it there would exempt whatever it chose to put behind the word. */
	if (sealedPattern.test(text)) return 'sealed'
	return 'prose'
}

function commentTextOf({ line, start, syntax }: { line: string; start: number; syntax: CommentSyntax }): string {
	const fromOpener = line.slice(start)
	const block = syntaxRules[syntax].block
	if (block === undefined || !fromOpener.startsWith(block.open)) return fromOpener
	const close = fromOpener.indexOf(block.close)
	return close === -1 ? fromOpener : fromOpener.slice(0, close + block.close.length)
}

/* Scans from line 1 rather than from the first added line, because a comment marker inside a multi-line
string is only recognisable from the line that opened the string - which a -U0 hunk usually excludes. */
export function findAddedComments({
	file,
	contents,
	addedLines,
}: {
	file: string
	contents: string
	addedLines: ReadonlySet<number>
}): AddedComments {
	const found: AddedComments = { prose: [], sealed: [], sql: [] }
	const syntax = syntaxForPath({ path: file })
	if (syntax === undefined) return found

	const blockOpener = syntaxRules[syntax].block?.open
	/* `/**` has to count as an opener as much as `/*` does, or every docblock is reported as a bare
	`/**` and the prose inside it is never read - the block swallows the lines that carry it. */
	const openerOnlyPattern = blockOpener === undefined ? undefined : new RegExp(`^${escapeForPattern(blockOpener)}\\**$`)
	let state: ScanState = codeState
	let openerAwaitingProse = false

	for (const [index, line] of contents.split('\n').entries()) {
		const lineNumber = index + 1
		const opened = state.kind === 'code'
		const scanned = scanCodeLine({ line, state, syntax })
		state = scanned.state

		if (opened && scanned.commentStart !== undefined) {
			const text = commentTextOf({ line, start: scanned.commentStart, syntax })
			// Report the opener instead and the gate prints a bare `/*`, naming no prose to weigh.
			if (openerOnlyPattern?.test(text) === true) {
				openerAwaitingProse = true
				continue
			}
			openerAwaitingProse = false
			if (!addedLines.has(lineNumber)) continue
			const verdict = classifyComment({ text, syntax })
			if (verdict !== undefined) found[verdict].push({ file, line: lineNumber, text })
			continue
		}

		if (!openerAwaitingProse) continue
		openerAwaitingProse = false
		if (!addedLines.has(lineNumber)) continue
		const text = line.replace(/^\s+/, '')
		const verdict = classifyComment({ text, syntax })
		if (verdict !== undefined) found[verdict].push({ file, line: lineNumber, text })
	}
	return found
}
