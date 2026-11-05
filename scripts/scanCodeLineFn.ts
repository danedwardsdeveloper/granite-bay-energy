/* The character-by-character walk is what keeps a delimiter inside a string from being read as a real
one - the `//` in `'a//b'`, every https:// in a URL, a `#` in `${#items}`, a block-close inside a quoted
glob. Rewrite this as a regex over the line and those all start reporting as comments. Regex literals
aren't special-cased (their `/` are escaped), and a `${}` expression inside a template is scanned as
template text - both are rare enough to have never fired. */

export const commentSyntaxes = ['jsLike', 'cLike', 'cSharp', 'hash', 'php', 'sql'] as const
export type CommentSyntax = (typeof commentSyntaxes)[number]

export type StringForm = {
	open: string
	close: string
	escapes: boolean
	doubling: boolean
	spansLines: boolean
}
export type BlockForm = { open: string; close: string }

export type SyntaxRules = {
	lineOpeners: ReadonlyArray<string>
	lineOpenerNeedsWordStart: boolean
	/* PHP 8 spells an attribute `#[Foo]`, which starts with a line opener and is code. Without the
	exception every attribute in a file reads as a comment, and the prose gate asks for it to be deleted. */
	lineOpenerExceptions: ReadonlyArray<string>
	block: BlockForm | undefined
	strings: ReadonlyArray<StringForm>
	heredocs: boolean
}

const slashBlock: BlockForm = { open: '/*', close: '*/' }

const escapedSingle: StringForm = { open: "'", close: "'", escapes: true, doubling: false, spansLines: false }
const escapedDouble: StringForm = { open: '"', close: '"', escapes: true, doubling: false, spansLines: false }
const backtick: StringForm = { open: '`', close: '`', escapes: true, doubling: false, spansLines: true }

/* Longest opener first in every `strings` list, because the walk takes the first that matches: put C#'s
plain `"` above `"""` and a raw string is read as an empty string followed by loose code. */
export const syntaxRules: Record<CommentSyntax, SyntaxRules> = {
	jsLike: {
		lineOpeners: ['//'],
		lineOpenerNeedsWordStart: false,
		lineOpenerExceptions: [],
		block: slashBlock,
		strings: [escapedSingle, escapedDouble, backtick],
		heredocs: false,
	},
	cLike: {
		lineOpeners: ['//'],
		lineOpenerNeedsWordStart: false,
		lineOpenerExceptions: [],
		block: slashBlock,
		strings: [escapedSingle, escapedDouble],
		heredocs: false,
	},
	cSharp: {
		lineOpeners: ['//'],
		lineOpenerNeedsWordStart: false,
		lineOpenerExceptions: [],
		block: slashBlock,
		strings: [
			{ open: '"""', close: '"""', escapes: false, doubling: false, spansLines: true },
			{ open: '$@"', close: '"', escapes: false, doubling: true, spansLines: true },
			{ open: '@$"', close: '"', escapes: false, doubling: true, spansLines: true },
			{ open: '@"', close: '"', escapes: false, doubling: true, spansLines: true },
			escapedDouble,
			escapedSingle,
		],
		heredocs: false,
	},
	hash: {
		lineOpeners: ['#'],
		lineOpenerNeedsWordStart: true,
		lineOpenerExceptions: [],
		block: undefined,
		strings: [
			{ open: "'", close: "'", escapes: false, doubling: false, spansLines: true },
			{ open: '"', close: '"', escapes: true, doubling: false, spansLines: true },
		],
		heredocs: true,
	},
	/* Heredocs stay off: PHP opens one with `<<<`, which the shell pattern behind the `heredocs` flag
	reads as a herestring. A `//` inside a PHP heredoc is reported as prose until that pattern grows. */
	php: {
		lineOpeners: ['//', '#'],
		lineOpenerNeedsWordStart: false,
		lineOpenerExceptions: ['#['],
		block: slashBlock,
		strings: [escapedSingle, escapedDouble],
		heredocs: false,
	},
	sql: {
		lineOpeners: ['--'],
		lineOpenerNeedsWordStart: false,
		lineOpenerExceptions: [],
		block: slashBlock,
		strings: [
			{ open: "'", close: "'", escapes: false, doubling: true, spansLines: true },
			{ open: '"', close: '"', escapes: false, doubling: true, spansLines: true },
		],
		heredocs: false,
	},
}

export const syntaxForExtension = {
	'.ts': 'jsLike',
	'.tsx': 'jsLike',
	'.js': 'jsLike',
	'.jsx': 'jsLike',
	'.mjs': 'jsLike',
	'.cjs': 'jsLike',
	'.mts': 'jsLike',
	'.cts': 'jsLike',
	'.astro': 'jsLike',
	'.css': 'cLike',
	'.scss': 'cLike',
	'.less': 'cLike',
	'.cs': 'cSharp',
	'.csx': 'cSharp',
	'.php': 'php',
	'.java': 'cLike',
	'.go': 'cLike',
	'.rs': 'cLike',
	'.swift': 'cLike',
	'.kt': 'cLike',
	'.kts': 'cLike',
	'.c': 'cLike',
	'.h': 'cLike',
	'.cpp': 'cLike',
	'.hpp': 'cLike',
	'.sh': 'hash',
	'.bash': 'hash',
	'.zsh': 'hash',
	'.sql': 'sql',
	Dockerfile: 'hash',
	'.yml': 'hash',
	'.yaml': 'hash',
	'.toml': 'hash',
} satisfies Record<string, CommentSyntax>

export type AuditableExtension = keyof typeof syntaxForExtension

const commentSyntaxSuffixes = Object.keys(syntaxForExtension) as AuditableExtension[]

// Fold these back in and brevityGate starts holding a workflow's `#` lines to the prose gates.
const linkOnlySuffixes: ReadonlyArray<AuditableExtension> = ['Dockerfile', '.yml', '.yaml', '.toml']

export const auditableExtensions: ReadonlyArray<AuditableExtension> = commentSyntaxSuffixes.filter(
	(suffix) => !linkOnlySuffixes.includes(suffix),
)

export function syntaxForPath({ path }: { path: string }): CommentSyntax | undefined {
	const extension = commentSyntaxSuffixes.find((candidate) => path.endsWith(candidate))
	return extension === undefined ? undefined : syntaxForExtension[extension]
}

export type ScanState =
	| { kind: 'code' }
	| { kind: 'block' }
	| { kind: 'string'; close: string; escapes: boolean; doubling: boolean; spansLines: boolean }
	| { kind: 'heredoc'; terminator: string }

export const codeState: ScanState = { kind: 'code' }

export type ScannedLine = { state: ScanState; commentStart: number | undefined }

const heredocPattern = /<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/

function stateForString({ form }: { form: StringForm }): ScanState {
	return { kind: 'string', close: form.close, escapes: form.escapes, doubling: form.doubling, spansLines: form.spansLines }
}

function endOfString({
	line,
	from,
	close,
	escapes,
	doubling,
}: {
	line: string
	from: number
	close: string
	escapes: boolean
	doubling: boolean
}): number | undefined {
	let index = from
	while (index < line.length) {
		if (escapes && line[index] === '\\') {
			index += 2
			continue
		}
		if (line.startsWith(close, index)) {
			if (doubling && line.startsWith(close + close, index)) {
				index += close.length * 2
				continue
			}
			return index + close.length
		}
		index += 1
	}
	return undefined
}

function atWordStart({ line, index }: { line: string; index: number }): boolean {
	if (index === 0) return true
	const previous = line[index - 1]
	return previous === undefined || /[\s;&|]/.test(previous)
}

export function scanCodeLine({ line, state, syntax }: { line: string; state: ScanState; syntax: CommentSyntax }): ScannedLine {
	const rules = syntaxRules[syntax]

	if (state.kind === 'heredoc') {
		return { state: line.trim() === state.terminator ? codeState : state, commentStart: undefined }
	}

	let index = 0
	let current: ScanState = state
	let commentStart: number | undefined

	while (index < line.length) {
		if (current.kind === 'block') {
			const close = rules.block?.close
			const at = close === undefined ? -1 : line.indexOf(close, index)
			if (close === undefined || at === -1) return { state: current, commentStart }
			index = at + close.length
			current = codeState
			continue
		}
		if (current.kind === 'string') {
			const end = endOfString({ line, from: index, close: current.close, escapes: current.escapes, doubling: current.doubling })
			if (end === undefined) {
				if (current.spansLines) return { state: current, commentStart }
				break
			}
			index = end
			current = codeState
			continue
		}

		const stringForm = rules.strings.find((form) => line.startsWith(form.open, index))
		if (stringForm !== undefined) {
			const opened = stateForString({ form: stringForm })
			const end = endOfString({
				line,
				from: index + stringForm.open.length,
				close: stringForm.close,
				escapes: stringForm.escapes,
				doubling: stringForm.doubling,
			})
			if (end === undefined) {
				if (stringForm.spansLines) return { state: opened, commentStart }
				break
			}
			index = end
			continue
		}

		const lineOpener = rules.lineOpeners.find((opener) => line.startsWith(opener, index))
		const excepted = rules.lineOpenerExceptions.some((exception) => line.startsWith(exception, index))
		// A line comment runs to end of line, so nothing after it changes the state.
		if (lineOpener !== undefined && !excepted && (!rules.lineOpenerNeedsWordStart || atWordStart({ line, index }))) {
			return { state: codeState, commentStart: commentStart ?? index }
		}
		if (rules.block !== undefined && line.startsWith(rules.block.open, index)) {
			commentStart = commentStart ?? index
			current = { kind: 'block' }
			index += rules.block.open.length
			continue
		}
		index += 1
	}

	if (rules.heredocs && current.kind === 'code' && commentStart === undefined) {
		const terminator = line.match(heredocPattern)?.[2]
		if (terminator !== undefined) return { state: { kind: 'heredoc', terminator }, commentStart }
	}
	return { state: current, commentStart }
}
