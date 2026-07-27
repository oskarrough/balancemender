/**
 * Argument parsing shared by `bun run sim` and `bun run sweep`.
 *
 * It lived in both of them, which is why `--tune` is here: a flag worth having is worth having in
 * both, and two copies of a parser is two places for `--seeds` to mean something slightly
 * different.
 */

export type Args = Record<string, (string | true)[]>

export function parse(argv: string[]): Args {
	const out: Args = {}
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i]
		if (!arg.startsWith('--')) continue
		const key = arg.slice(2)
		const next = argv[i + 1]
		const value = !next || next.startsWith('--') ? true : (i++, next)
		out[key] = [...(out[key] ?? []), value]
	}
	return out
}

export function cli(argv: string[]) {
	const args = parse(argv)

	/**
	 * A flag that needs a value. `--seed` on its own parses as `true`, and `Number(true)` is 1 —
	 * so without this check a typo silently runs a different fight than you asked for.
	 */
	function text(name: string) {
		const values = all(name)
		return values.length ? values[values.length - 1] : undefined
	}

	function num(name: string, fallback: number) {
		const raw = text(name)
		if (raw === undefined) return fallback
		const value = Number(raw)
		if (!Number.isFinite(value)) bail(`--${name} needs a number, got "${raw}"`)
		return value
	}

	/** Every occurrence of a repeatable flag, in the order they were given. */
	function all(name: string) {
		const values = args[name] ?? []
		if (values.includes(true)) bail(`--${name} needs a value`)
		return values as string[]
	}

	const flag = (name: string) => args[name] !== undefined

	return {text, num, all, flag}
}

export function bail(message: string): never {
	console.error(message)
	process.exit(1)
}

/**
 * Run something that validates input, and turn its throw into a one-line exit.
 *
 * Everything a script parses — rosters, policies, tunes — reports a bad value by throwing with a
 * message meant for a person. A stack trace above it helps nobody: the caller typo'd a spell name.
 */
export function attempt<T>(fn: () => T): T {
	try {
		return fn()
	} catch (error) {
		bail(String(error instanceof Error ? error.message : error))
	}
}
