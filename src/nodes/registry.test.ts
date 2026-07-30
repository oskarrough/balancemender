import {describe, expect, it} from 'vitest'
import {abilityRegistry} from './registry'

describe('the ability registry', () => {
	it('keys every ability by its stable id', () => {
		for (const [id, AbilityClass] of Object.entries(abilityRegistry)) expect(AbilityClass.id).toBe(id)
	})

	/**
	 * Every registered ability does something, and everything it does has a size. An outcome
	 * without a coefficient lands nothing, so this is where that stops being silent.
	 */
	it('gives every declared effect a size to land', () => {
		for (const [id, AbilityClass] of Object.entries(abilityRegistry)) {
			expect(AbilityClass.effects, `${id} has no effects`).not.toHaveLength(0)
			for (const effect of AbilityClass.effects) {
				expect(effect.coefficient, `${id} has a ${effect.label} with no coefficient`).toBeTypeOf('number')
			}
		}
	})
})
