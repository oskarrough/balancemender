import {describe, it, expect, afterEach} from 'vitest'
import {setSeed, random} from './rng'

const sequence = (seed: number, length = 5) => {
	setSeed(seed)
	return Array.from({length}, () => random())
}

afterEach(() => setSeed(null))

describe('setSeed', () => {
	it('gives every seed its own sequence, including 0', () => {
		expect(sequence(0)).not.toEqual(sequence(1))
		expect(sequence(1)).not.toEqual(sequence(2))
		expect(sequence(0)).not.toEqual(sequence(2))
	})

	it('replays the same sequence for the same seed', () => {
		expect(sequence(0)).toEqual(sequence(0))
		expect(sequence(42)).toEqual(sequence(42))
	})

	it('goes back to real randomness for null', () => {
		setSeed(7)
		const seeded = random()
		setSeed(null)
		expect(random()).not.toBe(seeded)
	})
})
