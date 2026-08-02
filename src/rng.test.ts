import {describe, it, expect} from 'vitest'
import {Rng} from './rng'

const sequence = (seed: number | null, length = 5) => {
	const rng = new Rng(seed)
	return Array.from({length}, () => rng.float())
}

const rngAt = (draw: number) => {
	const rng = new Rng(0)
	Object.defineProperty(rng, 'next', {value: () => draw})
	return rng
}

describe('Rng', () => {
	it('gives every seed its own sequence, including 0', () => {
		expect(sequence(0)).not.toEqual(sequence(1))
		expect(sequence(1)).not.toEqual(sequence(2))
		expect(sequence(0)).not.toEqual(sequence(2))
	})

	it('replays the same sequence for the same seed', () => {
		expect(sequence(0)).toEqual(sequence(0))
		expect(sequence(42)).toEqual(sequence(42))
	})

	it('rolls real randomness with no seed', () => {
		expect(sequence(null)).not.toEqual(sequence(null))
	})

	/** Two fights at once must not share a stream — the whole point of one of these per game. */
	it('draws independently of another instance on the same seed', () => {
		const a = new Rng(7)
		const b = new Rng(7)
		a.float()
		a.float()
		expect(b.float()).toBe(new Rng(7).float())
	})

	it('includes both naturalize bounds at RNG endpoints', () => {
		expect(rngAt(0).naturalize(100, 0.1)).toBe(90)
		expect(rngAt(1).naturalize(100, 0.1)).toBe(110)
	})

	it('returns deterministic integer values across a negative range', () => {
		const draws = [0, 0.25, 0.5, 0.75, 1]
		const values = draws.map((draw) => rngAt(draw).naturalize(-100, 0.1))
		expect(values).toEqual([-110, -105, -100, -95, -90])
	})
})
