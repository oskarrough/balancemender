import {describe, expect, it} from 'vitest'
import {settle} from '../test-setup'
import {GameLoop} from './game-loop'
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

		const game = new GameLoop({party: ['Tank'], enemies: ['Runt']})
		await settle()
		const wolf = game.enemies[0]
		wolf.abilities = {...wolf.abilities, WindUp}
		const before = game.party[0].health.current

		expect(wolf.useAbility('WindUp', game.party[0]).ok).toBe(true)
		expect(wolf.currentAbility?.id).toBe('WindUp')
		const attack = wolf.useAbility('Nip', game.party[0])
		expect(attack.ok).toBe(true)
		expect(game.party[0].health.current).toBeLessThan(before)
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
		const use = new abilityRegistry.Patch(game.player, game.party[0])
		await settle()
		expect(use.magnitudes).toEqual([100])

		const buff = {}
		game.player.addStatModifier(buff, STAT.INTELLECT, 10)

		expect(use.magnitudes).toEqual([100])
		expect(abilityRegistry.Patch.magnitudesFor(game.player)).toEqual([125])

		game.disconnect()
		await settle()
	})
})
