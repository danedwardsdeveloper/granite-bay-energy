#!/usr/bin/env node
// PreToolUse gate, both directions: a comment line whose text opens with `locked:` is one Dan has
// decided stays, and an agent can neither remove/reword one nor mint a new one. The asymmetry is
// what makes the marker unforgeable - Dan edits in his editor, which no hook sees, while an agent
// reaches a file only through Edit/Write/NotebookEdit (or a Bash redirect), all of which land here
// first. What a locked comment is ABOUT is not this gate's business, and not the next agent's.
//
// Matching is on the normalised line (trimmed, whitespace collapsed), so reindenting or moving a
// locked comment is fine and only its WORDING is held. Fails open: any parse/IO error lets the
// edit through rather than wedging all editing.
import { readFileSync } from 'node:fs'

const allow = () => process.exit(0)
const block = (reason) => {
	process.stdout.write(JSON.stringify({ decision: 'block', reason }))
	process.exit(0)
}

let input
try {
	input = JSON.parse(readFileSync(0, 'utf8'))
} catch {
	allow()
}

const ti = input.tool_input ?? {}
const marker = 'locked:'
// The comment openers across every file type here - //, /* and {/* for TS/TSX, <!-- for md, # and -- for sh/sql.
const lockedPattern = /(\/\/|\/\*|\{\/\*|<!--|--|#|\*)\s*locked:/i
const normalise = (line) => line.trim().replace(/\s+/g, ' ')

const lockedLines = (content) => {
	const counts = new Map()
	for (const raw of content.split('\n')) {
		const line = normalise(raw)
		if (!lockedPattern.test(line)) continue
		counts.set(line, (counts.get(line) ?? 0) + 1)
	}
	return counts
}

const mintNotice = `Dan alone writes the \`${marker}\` word, because that word is what exempts a line from the brevity gate - an agent able to type it could exempt its own prose with it. The comment is yours to propose: write the line where you want it, with \`Sealed:\` in place of \`${marker}\` (same length, so the width verdict holds through the swap), and name it in your report. The commit gate lists a \`Sealed:\` line as a proposal rather than asking you to justify it, so it survives to be read. Dan swaps the word. See ../fleet-hq/docs/brevity-guide.md.`

/* A Bash redirect is the one path to a file that isn't an Edit tool call, so the marker is refused
there too. Reads are untouched - it takes a write indicator AND the marker to block. */
if (input.tool_name === 'Bash') {
	const command = typeof ti.command === 'string' ? ti.command : ''
	const writesToDisk = /(^|\s)(sed\s+-i|perl\s+-i|tee\b|dd\s+of=)|>>?/.test(command)
	if (writesToDisk && command.toLowerCase().includes(marker)) {
		block(
			`This command writes a \`${marker}\` comment to a file through the shell, which is the same mint the Edit gate refuses. ${mintNotice}`,
		)
	}
	allow()
}

const filePath = ti.file_path ?? ti.filePath ?? ''
if (!filePath) allow()

let oldContent = ''
try {
	oldContent = readFileSync(filePath, 'utf8')
} catch {
	oldContent = '' // new file - nothing to protect yet
}

const applyEdit = (content, oldStr, newStr, replaceAll) => {
	if (typeof oldStr !== 'string' || oldStr === '') return content
	if (replaceAll) return content.split(oldStr).join(newStr ?? '')
	const i = content.indexOf(oldStr)
	if (i === -1) return content // edit won't apply; let the tool surface that itself
	return content.slice(0, i) + (newStr ?? '') + content.slice(i + oldStr.length)
}

let newContent
if (Array.isArray(ti.edits)) {
	newContent = ti.edits.reduce((acc, e) => applyEdit(acc, e.old_string, e.new_string, e.replace_all), oldContent)
} else if (typeof ti.old_string === 'string') {
	newContent = applyEdit(oldContent, ti.old_string, ti.new_string, ti.replace_all)
} else if (typeof ti.content === 'string') {
	newContent = ti.content
} else {
	allow()
}

const before = lockedLines(oldContent)
const after = lockedLines(newContent)

const removed = []
for (const [line, count] of before) {
	if ((after.get(line) ?? 0) < count) removed.push(line)
}
if (removed.length)
	block(
		`This edit removes or rewords a locked comment in ${filePath.split('/').pop()}. A \`${marker}\` line is kept by Dan's decision rather than by the brevity guide's tests - it is exempt from delete-by-default whatever its subject, so do not weigh it, shorten it or fold it into a neighbouring comment. Leave the line exactly as written and edit the code around it freely. If you believe it has become wrong, say so in your report with the reason and let Dan decide.\n\n${removed.join('\n')}`,
	)

const added = []
for (const [line, count] of after) {
	if ((before.get(line) ?? 0) < count) added.push(line)
}
if (added.length) block(`This edit adds a locked comment to ${filePath.split('/').pop()}. ${mintNotice}\n\n${added.join('\n')}`)

allow()
