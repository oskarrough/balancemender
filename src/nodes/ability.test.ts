// @vitest-environment happy-dom
import {beforeEach, describe, expect, it} from 'vitest'
import {combatLogs, clearLogs} from '../combatlog'
import {GameLoop} from './game-loop'
import {Ability} from './ability'
import {abilityRegistry} from './registry'

const step = () => Promise.resolve()

describe('abilities', () => {
	beforeEach(() => clearLogs())

	it('has one base and explicit classification data', () => {
		for (const AbilityClass of Object.values(abilityRegistry)) {
			expect(AbilityClass.prototype instanceof Ability, AbilityClass.id).toBe(true)
			expect(AbilityClass.id).toBeTruthy()
			expect(AbilityClass.name).toBeTruthy()
			expect(AbilityClass.tags.length).toBeGreaterThan(0)
			expect(AbilityClass.school).toBeTruthy()
			expect(AbilityClass.targetRule).toBeTruthy()
		}
		expect([
			abilityRegistry.FlashHeal.tags,
			abilityRegistry.FlashHeal.school,
			abilityRegistry.FlashHeal.targetRule,
		]).toEqual([['spell', 'healing'], 'holy', 'ally'])
		expect([
			abilityRegistry.WolfBite.tags,
			abilityRegistry.WolfBite.school,
			abilityRegistry.WolfBite.targetRule,
		]).toEqual([['attack', 'melee'], 'physical', 'enemy'])
		expect([
			abilityRegistry.HugeAttack.tags,
			abilityRegistry.HugeAttack.school,
			abilityRegistry.HugeAttack.targetRule,
		]).toEqual([['attack', 'ranged'], 'physical', 'enemy'])
	})

	it('looks up Flash Heal, Savage Bite and Nasty arrow through the same unit boundary', async () => {
		const game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf', 'Nakroth']})
		await step()
		const [wolf, nakroth] = game.enemies

		game.player.currentTarget = game.tank
		const heal = game.player.useAbility('FlashHeal')
		expect(heal.ok && heal.value.id).toBe('FlashHeal')

		wolf.currentTarget = game.tank
		const bite = wolf.useAbility('WolfBite')
		expect(bite.ok && bite.value.id).toBe('WolfBite')
		nakroth.currentTarget = game.tank
		const arrow = nakroth.useAbility('HugeAttack')
		expect(arrow.ok && arrow.value.id).toBe('HugeAttack')

		expect(combatLogs.some((event) => event.abilityId === 'WolfBite')).toBe(true)
		expect(combatLogs.some((event) => event.abilityId === 'HugeAttack')).toBe(true)
		await step()
		await step()
		game.disconnect()
	})

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
		const attack = wolf.useAbility('SmallAttack')
		expect(attack.ok).toBe(true)
		expect(game.tank.health.current).toBeLessThan(before)
		expect(wolf.mana).toBeUndefined()
		expect(wolf.currentAbility?.id).toBe('WindUp')
		await step()
		await step()
		game.disconnect()
	})

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
