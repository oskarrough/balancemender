import {describe, expect, it} from 'vitest'
import {GameLoop} from './game-loop'
import {AbilityUse} from './ability-use'
import {GlobalCooldown} from './global-cooldown'
import {abilityRegistry} from './registry'

const Heal = abilityRegistry.Heal

describe('ability use rules', () => {
	it('separates cast-wide restrictions from one ability being usable', () => {
		const game = new GameLoop({party: ['Tank'], enemies: []})
		const player = game.player
		player.gcd = new GlobalCooldown(player)
		expect(AbilityUse.whyNotAct(player, Heal)).toBe('global-cooldown')
		expect(AbilityUse.whyNotUse(player, Heal, game.tank)).toBeUndefined()
		expect(AbilityUse.validate(player, Heal)).toBe('global-cooldown')
		game.disconnect()
	})

	it('enforces the target rule owned by the ability', () => {
		const game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf']})
		expect(AbilityUse.whyNotUse(game.player, Heal, game.tank)).toBeUndefined()
		expect(AbilityUse.whyNotUse(game.player, Heal, game.enemies[0])).toBe('invalid-target')
		expect(AbilityUse.whyNotUse(game.enemies[0], abilityRegistry.SavageBite, game.tank)).toBeUndefined()
		game.disconnect()
	})

	/**
	 * Removal is not death: `Encounter.remove()` splices the unit out and leaves its health bar
	 * alone, so `alive` still reads true. A guard that asked only that healed someone who had left
	 * the fight, and logged a hit naming a unit the report has never heard of.
	 */
	it('lands nothing on a target that left the fight mid-cast', async () => {
		const game = new GameLoop({party: ['Tank'], enemies: []})
		const tank = game.tank
		tank.health.set(10)
		const use = game.player.useAbility('Heal', tank)
		expect(use.ok).toBe(true)
		if (!use.ok) return
		await Promise.resolve()

		expect(game.perform({type: 'remove', unit: tank.id}).ok).toBe(true)
		await Promise.resolve()
		await Promise.resolve()

		use.value.tick()
		expect(tank.alive).toBe(true)
		expect(tank.health.current).toBe(10)
		await Promise.resolve()
		game.disconnect()
	})

	/** The target belongs to the use, so nothing can be swapped under a cast — but it can die. */
	it('lands nothing when the target does not survive the cast', async () => {
		const game = new GameLoop({party: ['Tank'], enemies: []})
		game.tank.health.set(10)
		const use = game.player.useAbility('Heal', game.tank)
		expect(use.ok).toBe(true)
		if (!use.ok) return
		await Promise.resolve()

		game.tank.health.set(0)
		use.value.tick()
		expect(game.tank.health.current).toBe(0)
		await Promise.resolve()
		game.disconnect()
	})

	it('holds one ability on its own cooldown', async () => {
		const game = new GameLoop({party: ['Tank'], enemies: []})
		const player = game.player
		expect(game.perform({type: 'tune', of: 'ability', name: 'Heal', key: 'cooldown', value: 8000}).ok).toBe(true)
		expect(game.perform({type: 'use', ability: 'Heal', target: game.tank.id}).ok).toBe(true)
		player.currentAbility!._cycles = 1
		player.currentAbility!.destroy()
		await Promise.resolve()
		expect(AbilityUse.whyNotUse(player, Heal, game.tank)).toBe('cooldown')
		expect(AbilityUse.whyNotUse(player, abilityRegistry.FlashHeal, game.tank)).toBeUndefined()
		game.elapsedTime = 8000
		expect(AbilityUse.whyNotUse(player, Heal, game.tank)).toBeUndefined()
		game.perform({type: 'resetBalance'})
		game.disconnect()
	})

	it('checks mana only when the ability opts into a cost', () => {
		const game = new GameLoop({party: ['Tank'], enemies: []})
		const player = game.player
		player.mana!.set(Heal.cost)
		expect(AbilityUse.whyNotUse(player, Heal, game.tank)).toBeUndefined()
		expect(AbilityUse.whyNotUse(player, abilityRegistry.GreaterHeal, game.tank)).toBe('missing-mana')
		expect(AbilityUse.whyNotUse(player, abilityRegistry.ShieldBash, game.tank)).toBe('invalid-target')
		game.disconnect()
	})
})
