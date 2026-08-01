import {describe, expect, it} from 'vitest'
import {abilityRegistry} from './registry'

describe('the ability registry', () => {
	it('keys every ability by its stable id', () => {
		for (const [id, AbilityClass] of Object.entries(abilityRegistry)) expect(AbilityClass.id).toBe(id)
	})

	/**
	 * Every registered ability does something, and anything it does that has a size declares one.
	 * The exception is an effect with nothing to size — `Interrupt` cuts a cast rather than landing
	 * an amount — which declares `coefficient = undefined` to say so out loud.
	 */
	it('gives every declared effect a size to land', () => {
		for (const [id, AbilityClass] of Object.entries(abilityRegistry)) {
			expect(AbilityClass.effects, `${id} has no effects`).not.toHaveLength(0)
			for (const effect of AbilityClass.effects) {
				if (effect.coefficient === undefined) continue
				expect(effect.coefficient, `${id} has a ${effect.label} with no coefficient`).toBeTypeOf('number')
			}
		}
	})
})
