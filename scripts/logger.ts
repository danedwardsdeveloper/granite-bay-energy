/* biome-ignore-all lint/suspicious/noConsole: logger */

export const logger = {
	info: (...parts: ReadonlyArray<unknown>): void => console.info(...parts),
	error: (...parts: ReadonlyArray<unknown>): void => console.error(...parts),
}
