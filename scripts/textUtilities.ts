export function addS(countable: unknown): string {
	const length = Array.isArray(countable) ? countable.length : countable
	return length === 1 ? '' : 's'
}
