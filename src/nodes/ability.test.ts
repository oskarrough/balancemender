import {describe, expect, it} from 'vitest'
import {settle} from '../test-setup'
import {TankGameLoop as GameLoop} from '../test-fixtures'
import {Ability} from './ability'
import {abilityRegistry} from './registry'
import {STAT} from './stats'

describe('abilities', () => {
	it('keeps ordinary attacks synchronous, free and independent from a concurrent cast', async () => {
		class WindUp extends Ability {
			static id = 'WindUp'
			static name = 'Wind up'
			static tags = ['spell'] as const
			static school = 'physical' as const
			static targets = 'enemy' as const
			static castTime = 5000
			static gcd = true
		}

		const game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf']})
		await settle()
		const wolf = game.enemies[0]
		wolf.abilities = {...wolf.abilities, WindUp}
		const before = game.tank.health.current

		expect(wolf.useAbility('WindUp', game.tank).ok).toBe(true)
		expect(wolf.currentAbility?.id).toBe('WindUp')
		const attack = wolf.useAbility('QuickStab', game.tank)
		expect(attack.ok).toBe(true)
		expect(game.tank.health.current).toBeLessThan(before)
		expect(wolf.mana).toBeUndefined()
		expect(wolf.currentAbility?.id).toBe('WindUp')
		await settle()
		await settle()
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

	it('snapshots power into a use, so a mid-cast buff reaches only the next one', async () => {
		const game = new GameLoop({party: ['Tank'], enemies: []})
		await settle()
		const use = new abilityRegistry.Heal(game.player, game.tank)
		await settle()
		expect(use.magnitudes).toEqual([80])

		const buff = {}
		game.player.addStatModifier(buff, STAT.INTELLECT, 10)

		expect(use.magnitudes).toEqual([80])
		expect(abilityRegistry.Heal.magnitudesFor(game.player)).toEqual([100])

		game.disconnect()
		await settle()
	})
})
