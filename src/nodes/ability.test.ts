import {describe, expect, it} from 'vitest'
import {GameLoop} from './game-loop'
import {Ability} from './ability'
import {abilityRegistry} from './registry'

const step = () => Promise.resolve()

describe('abilities', () => {
	it('keeps ordinary attacks synchronous, free and independent from a concurrent cast', async () => {
		class WindUp extends Ability {
			static id = 'WindUp'
			static name = 'Wind up'
			static tags = ['spell'] as const
			static school = 'physical' as const
			static targetRule = 'enemy' as const
			static castTime = 5000
			static gcd = true
		}

		const game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf']})
		await step()
		const wolf = game.enemies[0]
		wolf.abilities = {...wolf.abilities, WindUp}
		wolf.currentTarget = game.tank
		const before = game.tank.health.current

		expect(wolf.useAbility('WindUp').ok).toBe(true)
		expect(wolf.currentAbility?.id).toBe('WindUp')
		const attack = wolf.useAbility('QuickStab')
		expect(attack.ok).toBe(true)
		expect(game.tank.health.current).toBeLessThan(before)
		expect(wolf.mana).toBeUndefined()
		expect(wolf.currentAbility?.id).toBe('WindUp')
		await step()
		await step()
		game.disconnect()
	})

	/** Repetition belongs to a cadence. An attack that carried its own would fire on two schedules. */
	it('keeps cadence timing off ability classes', () => {
		for (const AbilityClass of Object.values(abilityRegistry).filter((ability) =>
			(ability.tags as readonly string[]).includes('attack'),
		)) {
			expect(Object.hasOwn(AbilityClass, 'delay'), AbilityClass.id).toBe(false)
			expect(Object.hasOwn(AbilityClass, 'interval'), AbilityClass.id).toBe(false)
			expect(Object.hasOwn(AbilityClass, 'repeat'), AbilityClass.id).toBe(false)
		}
	})
})
