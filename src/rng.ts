/**
 * One fight's source of randomness. `GameLoop` owns one as `game.rng`, so two fights running at
 * once never draw from the same stream.
 *
 * Unseeded — how the browser plays — this is just `Math.random`. Seed it and every fight replays
 * identically, which is what makes simulated fights comparable when you change one balance number
 * and run them again. Anything a fight replays must roll through here; a wobble nobody replays —
 * the UI's jitter — uses `Math.random` directly and stays out of the stream.
 */
export class Rng {
	private next: () => number

	/** Pass a number for a reproducible fight, `null` for real randomness. */
	constructor(readonly seed: number | null = null) {
		if (seed === null) {
			this.next = Math.random
			return
		}
		// mulberry32 — tiny, fast, good enough for damage rolls. The golden-ratio offset keeps the
		// state away from zero without folding seed 0 onto seed 1, which `|| 1` used to do.
		let a = ((seed >>> 0) + 0x9e3779b9) >>> 0
		this.next = () => {
			a = (a + 0x6d2b79f5) >>> 0
			let t = Math.imul(a ^ (a >>> 15), 1 | a)
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296
		}
	}

	/** 0 to 1, the raw draw. */
	float() {
		return this.next()
	}

	/** A whole number, inclusive of both ends. */
	int(min: number, max: number) {
		const low = Math.min(min, max)
		const high = Math.max(min, max)
		return Math.min(high, Math.floor(this.next() * (high - low + 1) + low))
	}

	/**
	 * A number within ±`percentage` of the original, so no two heals land identically.
	 * e.g. `naturalize(100, 0.1)` returns a number between 90 and 110.
	 */
	naturalize(num = 0, percentage = 0.05) {
		const bounds = [num - num * percentage, num + num * percentage]
		const low = Math.ceil(Math.min(...bounds))
		const high = Math.floor(Math.max(...bounds))
		return this.int(low, high)
	}
}
