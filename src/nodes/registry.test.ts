// @vitest-environment happy-dom
import {describe, expect, it} from 'vitest'
import {Damage, Heal} from './effects'
import {abilityRegistry} from './registry'

describe('the ability registry', () => {
	it('keys every ability by its stable id', () => {
		for (const [id, AbilityClass] of Object.entries(abilityRegistry)) expect(AbilityClass.id).toBe(id)
	})

	/**
	 * An effect reads its magnitude off the ability that declares it, so a Damage with no range or a
	 * Heal with no amount is a silent nothing at runtime. This is where it stops being silent.
	 */
	it('gives every declared effect the number it reads', () => {
		for (const [id, AbilityClass] of Object.entries(abilityRegistry)) {
			expect(AbilityClass.effects, `${id} has no effects`).not.toHaveLength(0)
			for (const effect of AbilityClass.effects) {
				if (effect instanceof Damage) {
					expect(AbilityClass.minDamage, `${id} declares Damage`).toBeTypeOf('number')
					expect(AbilityClass.maxDamage, `${id} declares Damage`).toBeTypeOf('number')
				}
				if (effect instanceof Heal) expect(AbilityClass.magnitude, `${id} declares Heal`).toBeTypeOf('number')
			}
		}
	})
})
