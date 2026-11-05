/* A placeholder title is the one commit mistake with no cheap undo - `git commit --amend` is refused by
the hook and every `git reset` is banned outright, so an "x" that lands has to be amended by hand and a
pushed one cannot be fixed at all. Admit a single word, or drop the floor below twelve, and `x2` passes
again. Twelve and two clear every genuine title across the fleet except the one-word `Formatting`. */
export const minimumTitleCharacters = 12
export const minimumTitleWords = 2

export function commitTitleRefusal({ title }: { title: string }): string | undefined {
	const trimmed = title.trim()
	const wordCount = trimmed.split(/\s+/).filter((word) => word !== '').length

	if (trimmed.length >= minimumTitleCharacters && wordCount >= minimumTitleWords) return undefined

	return [
		`"${trimmed}" is ${wordCount} word${wordCount === 1 ? '' : 's'} and ${trimmed.length} character${trimmed.length === 1 ? '' : 's'} - a commit title needs at least ${minimumTitleWords} words and ${minimumTitleCharacters} characters.`,
		'`pnpm commit` is never a dry run. Running it again to re-read the brevity gate commits whatever title you pass, and the gate itself passes the second time because it lists only what changed since the last attempt.',
	].join('\n')
}
