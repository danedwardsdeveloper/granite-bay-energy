import { expect, test } from 'vitest'
import { type AddedLine, type CommentDirective, type CommentVerdict, findAddedComments, parseAddedLines } from './brevityGateFn.ts'

const parseCases: [label: string, diff: string, expected: AddedLine[]][] = [
	[
		'numbers added lines from the hunk header',
		`diff --git a/src/a.ts b/src/a.ts
index 1111111..2222222 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -11,0 +12,2 @@ export function a() {
+const first = 1
+const second = 2`,
		[
			{ line: 12, text: 'const first = 1' },
			{ line: 13, text: 'const second = 2' },
		],
	],
	[
		'restarts the count at each hunk',
		`@@ -3,0 +4 @@
+const first = 1
@@ -40,0 +52,2 @@
+const second = 2
+const third = 3`,
		[
			{ line: 4, text: 'const first = 1' },
			{ line: 52, text: 'const second = 2' },
			{ line: 53, text: 'const third = 3' },
		],
	],
	['reads a hunk header carrying no line count', '@@ -1 +1 @@\n+const only = 1', [{ line: 1, text: 'const only = 1' }]],
	[
		'ignores removed lines',
		`@@ -8,2 +8,1 @@
-const removed = 1
+const kept = 1`,
		[{ line: 8, text: 'const kept = 1' }],
	],
	['ignores the +++ file header', '+++ b/src/a.ts\n@@ -0,0 +1 @@\n+const added = 1', [{ line: 1, text: 'const added = 1' }]],
	[
		'advances past context lines when the diff carries them',
		`@@ -4,3 +4,4 @@
 const before = 1
+const inserted = 1
 const after = 2`,
		[{ line: 5, text: 'const inserted = 1' }],
	],
	[
		'reads an added line from a new file, whose hunk starts at zero',
		'@@ -0,0 +1,1 @@\n+const brandNew = 1',
		[{ line: 1, text: 'const brandNew = 1' }],
	],
]

test.each(parseCases)('%s', (_label, diff, expected) => {
	expect(parseAddedLines({ diff })).toEqual(expected)
})

const tsFile = 'src/example.ts'
const sqlFile = 'drizzle/0001_add_barcodes.sql'
const cSharpFile = 'Services/PatronService.cs'
const shellFile = 'scripts/deploy.sh'
const phpFile = 'wp-content/mu-plugins/catalogue.php'
const themeStylesheet = 'wp-content/themes/raccoon-crew/style.css'

function find({ file, lines, added }: { file: string; lines: ReadonlyArray<string>; added?: ReadonlyArray<number> | undefined }) {
	const addedLines = new Set(added ?? lines.map((_line, index) => index + 1))
	return findAddedComments({ file, contents: lines.join('\n'), addedLines })
}

function textsOf({
	file,
	lines,
	verdict,
	added,
}: {
	file: string
	lines: ReadonlyArray<string>
	verdict: CommentVerdict
	added?: ReadonlyArray<number> | undefined
}): string[] {
	return find({ file, lines, added })[verdict].map((comment) => comment.text)
}

const verdictCases: [label: string, file: string, lines: string[], verdict: CommentVerdict, expected: string[]][] = [
	[
		'a full-line comment',
		tsFile,
		['// the loan closes before the copy is freed'],
		'prose',
		['// the loan closes before the copy is freed'],
	],
	[
		'an indented comment, reported without its indentation',
		tsFile,
		['\t\t// the patron may already be deleted'],
		'prose',
		['// the patron may already be deleted'],
	],
	[
		'a self-closing block comment',
		tsFile,
		['/* the fine is waived when fines are off */'],
		'prose',
		['/* the fine is waived when fines are off */'],
	],
	[
		'the prose after a bare block opener, not the opener',
		tsFile,
		['/*', 'the copy count is denormalised nowhere', '*/'],
		'prose',
		['the copy count is denormalised nowhere'],
	],
	['nothing for a plain line of code', tsFile, ['const copies = 3'], 'prose', []],
	['a php double-slash comment', phpFile, ['// the loan is already closed'], 'prose', ['// the loan is already closed']],
	['a php hash comment, which the other c-like syntaxes do not have', phpFile, ['# the fine is waived'], 'prose', ['# the fine is waived']],
	['nothing for a php 8 attribute, which opens with a hash', phpFile, ['#[Deprecated]', 'function lend() {}'], 'prose', []],
	['nothing for a hash inside a php single-quoted string', phpFile, ["$anchor = 'https://example.com/#copies';"], 'prose', []],
	[
		'the prose in a php docblock, not the opener',
		phpFile,
		['/**', ' * the copy count is denormalised nowhere', ' */'],
		'prose',
		['* the copy count is denormalised nowhere'],
	],
	[
		'nothing for the wordpress plugin header, which wordpress parses as metadata',
		phpFile,
		['<?php', '/**', ' * Plugin Name: Raccoon Crew catalogue', ' * Version: 1.0.0', ' */'],
		'prose',
		[],
	],
	[
		'nothing for the theme stylesheet header, whose Template field makes the child theme inherit',
		themeStylesheet,
		['/*', 'Theme Name: Raccoon Crew', 'Template: astra', '*/'],
		'prose',
		[],
	],
	[
		'nothing for a bare marker holding an argument list open',
		tsFile,
		['const overdue = and(', '\teq(loansTable.id, loanId), //', '\teq(loansTable.returned, false),', ')'],
		'prose',
		[],
	],
	[
		'a comment trailing a line of code, the comment alone',
		tsFile,
		['const copies = 3 // one of them is on loan'],
		'prose',
		['// one of them is on loan'],
	],
	[
		'a block comment opening mid-line, without the code after it',
		tsFile,
		['const copies = /* one is on loan */ 3'],
		'prose',
		['/* one is on loan */'],
	],
	['nothing for a url, which carries the same two slashes', tsFile, ['const site = "https://example.com"'], 'prose', []],
	['nothing for a double slash inside a single-quoted string', tsFile, ["const glob = 'src//deep'"], 'prose', []],
	[
		'a comment sitting after a url has closed',
		tsFile,
		['const site = "https://example.com" // staging differs'],
		'prose',
		['// staging differs'],
	],
	[
		'nothing for what looks like a comment inside an open template',
		tsFile,
		['const query = `', '// this is template text', '`'],
		'prose',
		[],
	],
	[
		'nothing for a trailing directive',
		tsFile,
		['const wide = value as never // biome-ignore lint/suspicious/noExplicitAny: the SDK types it wide'],
		'prose',
		[],
	],
	[
		'prose sitting beside a directive, but not the directive',
		tsFile,
		['// biome-ignore lint/style/noVar: the SDK needs it', '// and here is why we gave up'],
		'prose',
		['// and here is why we gave up'],
	],
	['nothing for the run command a test file ends with', tsFile, ['/*', 'pnpm run-tests unit loanReturns', '*/'], 'prose', []],
	[
		'a Sealed line, as a proposal',
		tsFile,
		['// Sealed: the index predicate is load bearing'],
		'sealed',
		['// Sealed: the index predicate is load bearing'],
	],
	[
		'a lower-case sealed line, as the same proposal',
		tsFile,
		['// sealed: the index predicate is load bearing'],
		'sealed',
		['// sealed: the index predicate is load bearing'],
	],
	['no Sealed line in the justify pile', tsFile, ['// Sealed: the index predicate is load bearing'], 'prose', []],
	[
		'sql prose, which a migration may never carry',
		sqlFile,
		['-- Backfill so in-flight counters survive'],
		'sql',
		['-- Backfill so in-flight counters survive'],
	],
	['no squawk-ignore, the one legal sql comment', sqlFile, ['-- squawk-ignore ban-drop-column'], 'sql', []],
	['no statement-breakpoint marker, which drizzle-kit generates', sqlFile, ['--> statement-breakpoint'], 'sql', []],
	[
		'a sql block comment',
		sqlFile,
		['/* the contract phase of expand and contract */'],
		'sql',
		['/* the contract phase of expand and contract */'],
	],
	['no sql prose in the justify pile', sqlFile, ['-- why this column went'], 'prose', []],
	['nothing for a double dash inside a quoted sql identifier', sqlFile, ['ALTER TABLE "od--d" ADD COLUMN "z" text;'], 'sql', []],
	[
		'a C# line comment',
		cSharpFile,
		['// the membership row owns the display name'],
		'prose',
		['// the membership row owns the display name'],
	],
	[
		'a C# xml doc comment, which is prose about the code below it',
		cSharpFile,
		['/// <summary>Loads a patron</summary>'],
		'prose',
		['/// <summary>Loads a patron</summary>'],
	],
	['nothing for a double slash inside a C# verbatim string', cSharpFile, ['var path = @"C:\\books\\//notes";'], 'prose', []],
	['nothing for a double slash inside a C# raw string', cSharpFile, ['var raw = """a//b""";'], 'prose', []],
	[
		'nothing for a doubled quote inside a C# verbatim string, which does not close it',
		cSharpFile,
		['var quoted = @"he said ""go//now"" then";'],
		'prose',
		[],
	],
	['a shell comment', shellFile, ['# the staging database is reseeded nightly'], 'prose', ['# the staging database is reseeded nightly']],
	['nothing for a shebang', shellFile, ['#!/usr/bin/env bash'], 'prose', []],
	// biome-ignore lint/suspicious/noTemplateCurlyInString: bash parameter expansion, not an interpolation
	['nothing for a hash inside a parameter expansion', shellFile, ['echo "${#items} left"'], 'prose', []],
	['nothing for a url fragment', shellFile, ['curl https://example.com/books#chapter-2'], 'prose', []],
	['nothing for a hash inside a single-quoted shell string', shellFile, ["echo 'a#b'"], 'prose', []],
	['a shell comment trailing a command', shellFile, ['rm -rf "$dir" # the lock is stale by now'], 'prose', ['# the lock is stale by now']],
	[
		'nothing for a hash inside a heredoc body, which is data',
		shellFile,
		['cat <<EOF', '# this line is content, not prose', 'EOF'],
		'prose',
		[],
	],
	[
		'a shell comment below a heredoc that has closed',
		shellFile,
		['cat <<EOF', 'content', 'EOF', '# the lock is stale by now'],
		'prose',
		['# the lock is stale by now'],
	],
	['nothing for a shellcheck directive', shellFile, ['# shellcheck disable=SC2086'], 'prose', []],
]

test.each(verdictCases)('finds %s', (_label, file, lines, verdict, expected) => {
	expect(textsOf({ file, lines, verdict })).toEqual(expected)
})

const directiveFixtures: Record<CommentDirective, string> = {
	'locked:': 'this line stays whatever its subject',
	'cspell:': 'ignore bookbinder',
	'biome-ignore': 'lint/suspicious/noExplicitAny: the SDK types it wide',
	'eslint-disable': 'no-console',
	'eslint-enable': 'no-console',
	'prettier-ignore': '',
	'@ts-expect-error': 'the upstream type is wrong',
	'@ts-ignore': 'the upstream type is wrong',
	'@ts-nocheck': '',
	'v8 ignore': 'next 3',
	'c8 ignore': 'next 3',
	'@vitest-environment': 'jsdom',
	'@type': '{import("vitest").UserConfig}',
	'@param': 'orgId the tenant to scope to',
	'@returns': 'the patron rows',
	shellcheck: 'disable=SC2086',
	nolint: 'errcheck',
	'go:': 'generate mockgen -source patron.go',
}

const directiveCases = Object.entries(directiveFixtures)

test.each(directiveCases)('never lists the %s directive, which a reader cannot weigh', (directive, rest) => {
	const text = `// ${directive} ${rest}`.trimEnd()
	expect(textsOf({ file: tsFile, lines: [text], verdict: 'prose' })).toEqual([])
})

const partialCases: [label: string, file: string, lines: string[], added: number[], expected: string[]][] = [
	[
		'nothing for a marker inside a template the hunk did not open',
		tsFile,
		['const query = `', 'SELECT id', '// this is template text', 'FROM copies', '`'],
		[3],
		[],
	],
	[
		'a comment below a template that closed above the hunk',
		tsFile,
		['const query = `SELECT id FROM copies`', 'const total = 3', '// the count excludes lost copies'],
		[3],
		['// the count excludes lost copies'],
	],
	[
		'nothing for a hash inside a heredoc the hunk did not open',
		shellFile,
		['cat <<EOF', 'first line', '# this line is content, not prose', 'EOF'],
		[3],
		[],
	],
	[
		'nothing for a slash pair inside a C# verbatim string the hunk did not open',
		cSharpFile,
		['var sql = @"SELECT id', '// this is string text', 'FROM copies";'],
		[2],
		[],
	],
	[
		'only the added comment, not the one already committed',
		tsFile,
		['// the first comment', 'const copies = 3', '// the second comment'],
		[3],
		['// the second comment'],
	],
]

test.each(partialCases)('%s', (_label, file, lines, added, expected) => {
	expect(textsOf({ file, lines, verdict: 'prose', added })).toEqual(expected)
})

test('reports the line the comment sits on, which is what makes the output clickable', () => {
	const lines = ['const a = 1', 'const b = 2', '// the third line']
	expect(find({ file: tsFile, lines }).prose).toEqual([{ file: tsFile, line: 3, text: '// the third line' }])
})

test('reports nothing for a file type it has no syntax for', () => {
	expect(find({ file: 'README.md', lines: ['<!-- the readme is not audited -->'] }).prose).toEqual([])
})

/*
pnpm run-tests unit brevityGate
*/
