/**
 * The game's source of randomness.
 *
 * Unseeded — how the browser plays — this is just `Math.random`. Seed it and every
 * fight replays identically, which is what makes simulated fights comparable when
 * you change one balance number and run them again.
 */
let next: (() => number) | null = null

/** Pass a number for a reproducible run, `null` to go back to Math.random. */
export function setSeed(seed: number | null) {
	if (seed === null) {
		next = null
		return
	}
	// mulberry32 — tiny, fast, good enough for damage rolls. The golden-ratio offset keeps the
	// state away from zero without folding seed 0 onto seed 1, which `|| 1` used to do.
	let a = ((seed >>> 0) + 0x9e3779b9) >>> 0
	next = () => {
		a = (a + 0x6d2b79f5) >>> 0
		let t = Math.imul(a ^ (a >>> 15), 1 | a)
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

export function random() {
	return next ? next() : Math.random()
}
