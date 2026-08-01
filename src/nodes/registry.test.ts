import {describe, expect, it} from 'vitest'
import {Heal} from './effects'
import {abilityRegistry, playerAbilities} from './registry'
import * as spells from './spells'

describe('the ability registry', () => {
	it('keys every ability by its stable id', () => {
		for (const [id, AbilityClass] of Object.entries(abilityRegistry)) expect(AbilityClass.id).toBe(id)
	})

	it('exposes exactly the Patch and Mend direct-heal pair to the player', () => {
		expect(
			Object.values(spells)
				.filter((AbilityClass) => AbilityClass.effects.some((effect) => effect instanceof Heal))
				.map((AbilityClass) => AbilityClass.id),
		).toEqual(['Patch', 'Mend', 'Lick'])
		expect(
			Object.values(playerAbilities)
				.filter((AbilityClass) => AbilityClass.effects.some((effect) => effect instanceof Heal))
				.map((AbilityClass) => AbilityClass.id),
		).toEqual(['Patch', 'Mend'])
		expect(playerAbilities.Patch.cost).toBe(80)
		expect(playerAbilities.Patch.castTime).toBe(1000)
		expect(playerAbilities.Patch.sweetSpot).toBe(false)
		expect(playerAbilities.Patch.effects[0]).toMatchObject({coefficient: 1})
		expect(playerAbilities.Mend.cost).toBe(60)
		expect(playerAbilities.Mend.castTime).toBe(3000)
		expect(playerAbilities.Mend.sweetSpot).toBe(true)
		expect(playerAbilities.Mend.effects[0]).toMatchObject({coefficient: 1.45})
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
