#!/usr/bin/env node
/* PreToolUse(Bash). Do not widen this to audit what a commit CONTAINS - that needs the file list, which
means parsing paths out of shell text, which is where every bypass of this gate has lived. commit.ts does
that half, on argv the shell has already expanded.

The rule is imported rather than reimplemented so it stays unit tested, and node strips the types on the
way in. That works only while commitEntryPointFn has no relative imports of its own - node needs explicit
.ts extensions where our tsconfig omits them, and this hook fails open, so adding one would retire the
gate silently rather than erroring.

Any parse failure exits 0: a broken hook must never block a commit. */
import { readFileSync } from 'node:fs'
import { commandBypassesCommitScript } from '../../scripts/commitEntryPointFn.ts'

let input
try {
	input = JSON.parse(readFileSync(0, 'utf8'))
} catch {
	process.exit(0)
}

const command = typeof input.tool_input?.command === 'string' ? input.tool_input.command : ''
if (!commandBypassesCommitScript({ command })) process.exit(0)

const reason = `This reaches git commit without going through the commit script, which is the only route that runs the brevity gate over the comments your change adds.

Use \`pnpm commit "<description>" <path> [path...]\` instead, naming the exact paths you touched. It stages and commits only those, so a sibling agent's in-flight work in this shared tree is never swept in, and it fails loudly on a path with no changes rather than committing a subset.

Push is a separate step - run \`git push\` once your commits have landed. See ../fleet-hq/docs/commit-guide.md.`

process.stdout.write(
	JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } }),
)
process.exit(0)
