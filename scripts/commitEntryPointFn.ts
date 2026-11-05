const quotedSpanPattern = /'[^']*'|"(\\.|[^"\\])*"/g
const separatorPattern = /[;&|\n]+/

/* Quoted text is removed before anything is looked for in it, so a commit message that mentions the
words being matched is not itself a match - `pnpm commit "Fix the git commit parsing" src/a.ts` is a
sanctioned commit, and reading the raw command refuses it. */
function withoutQuotedText(command: string): string {
	return command.replace(quotedSpanPattern, ' quoted ')
}

/* Tokens are compared whole rather than searched for, because `commit` appears inside plenty of
arguments that commit nothing - drop to `segment.includes('commit')` and `git log --grep=commit` is
refused. */
function segmentInvokesGitCommit(segment: string): boolean {
	const tokens = segment.split(/\s+/).filter((token) => token !== '')
	const gitIndex = tokens.indexOf('git')
	if (gitIndex === -1) return false
	return tokens.slice(gitIndex + 1).includes('commit')
}

export function commandBypassesCommitScript({ command }: { command: string }): boolean {
	return withoutQuotedText(command).split(separatorPattern).some(segmentInvokesGitCommit)
}
