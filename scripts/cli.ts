/**
 * What a command line needs that `node:util` does not do.
 *
 * `parseArgs` does the parsing in both scripts, and its strictness is the reason: an unknown flag
 * or a `--seed` with no value is an error there, where a hand-rolled parser used to shrug and run
 * a different fight than the one you asked for.
 */

export function bail(message: string): never {
	console.error(message)
	process.exit(1)
}

/**
 * Run something that validates input, and turn its throw into a one-line exit.
 *
 * Everything these scripts parse — flags, enemy groups, policies, tunes — reports a bad value by
 * throwing with a message meant for a person. A stack trace above it helps nobody: the caller
 * typo'd an ability name.
 */
export function attempt<T>(fn: () => T): T {
	try {
		return fn()
	} catch (error) {
		bail(String(error instanceof Error ? error.message : error))
	}
}

/** `parseArgs` has no number type, and `Number(undefined)` is `NaN` rather than your default. */
export function num(name: string, raw: string | undefined, fallback: number) {
	if (raw === undefined) return fallback
	const value = Number(raw)
	if (!Number.isFinite(value)) bail(`--${name} needs a number, got "${raw}"`)
	return value
}
