import {afterEach, describe, expect, it} from 'vitest'
import {settle} from '../test-setup'
import {GameLoop} from './game-loop'
import {AbilityUse} from './ability-use'
import {GlobalCooldown} from './global-cooldown'
import {abilityRegistry} from './registry'

const Heal = abilityRegistry.Heal

let game!: GameLoop
afterEach(() => game.disconnect())

describe('ability use rules', () => {
	it('separates cast-wide restrictions from one ability being usable', () => {
		game = new GameLoop({party: ['Tank'], enemies: []})
		const player = game.player
		player.gcd = new GlobalCooldown(player)
		expect(AbilityUse.whyNotAct(player, Heal)).toBe('global-cooldown')
		expect(AbilityUse.whyNotUse(player, Heal, game.party[0])).toBeUndefined()
		expect(AbilityUse.validate(player, Heal)).toBe('global-cooldown')
	})

	it('enforces the target rule owned by the ability', () => {
		game = new GameLoop({party: ['Tank'], enemies: ['Runt']})
		expect(AbilityUse.whyNotUse(game.player, Heal, game.party[0])).toBeUndefined()
		expect(AbilityUse.whyNotUse(game.player, Heal, game.enemies[0])).toBe('invalid-target')
		expect(AbilityUse.whyNotUse(game.enemies[0], abilityRegistry.SavageBite, game.party[0])).toBeUndefined()
	})

	/**
	 * Removal is not death: `Fight.remove()` splices the unit out and leaves its health bar
	 * alone, so `alive` still reads true. A guard that asked only that healed someone who had left
	 * the fight, and logged a hit naming a unit the report has never heard of.
	 */
	it('lands nothing on a target that left the fight mid-cast', async () => {
		game = new GameLoop({party: ['Tank'], enemies: []})
		const tank = game.party[0]
		tank.health.set(10)
		const use = game.player.useAbility('Heal', tank)
		expect(use.ok).toBe(true)
		if (!use.ok) return
		await settle()

		expect(game.perform({type: 'remove', unit: tank.id}).ok).toBe(true)
		await settle()
		await settle()

		use.value.tick()
		expect(tank.alive).toBe(true)
		expect(tank.health.current).toBe(10)
		await settle()
	})

	/** The target belongs to the use, so nothing can be swapped under a cast — but it can die. */
	it('lands nothing when the target does not survive the cast', async () => {
		game = new GameLoop({party: ['Tank'], enemies: []})
		game.party[0].health.set(10)
		const use = game.player.useAbility('Heal', game.party[0])
		expect(use.ok).toBe(true)
		if (!use.ok) return
		await settle()

		game.party[0].health.set(0)
		use.value.tick()
		expect(game.party[0].health.current).toBe(0)
		await settle()
	})

	it('holds one ability on its own cooldown', async () => {
		game = new GameLoop({party: ['Tank'], enemies: []})
		const player = game.player
		expect(game.perform({type: 'tune', of: 'ability', name: 'Heal', key: 'cooldown', value: 8000}).ok).toBe(true)
		expect(game.perform({type: 'use', ability: 'Heal', target: game.party[0].id}).ok).toBe(true)
		player.currentAbility!._cycles = 1
		player.currentAbility!.destroy()
		await settle()
		expect(AbilityUse.whyNotUse(player, Heal, game.party[0])).toBe('cooldown')
		expect(AbilityUse.whyNotUse(player, abilityRegistry.Patch, game.party[0])).toBeUndefined()
		game.elapsedTime = 8000
		expect(AbilityUse.whyNotUse(player, Heal, game.party[0])).toBeUndefined()
		game.perform({type: 'resetBalance'})
	})

	it('checks mana only when the ability opts into a cost', () => {
		game = new GameLoop({party: ['Tank'], enemies: []})
		const player = game.player
		player.mana!.set(Heal.cost)
		expect(AbilityUse.whyNotUse(player, Heal, game.party[0])).toBeUndefined()
		expect(AbilityUse.whyNotUse(player, abilityRegistry.Mend, game.party[0])).toBe('missing-mana')
		expect(AbilityUse.whyNotUse(player, abilityRegistry.ShieldBash, game.party[0])).toBe('invalid-target')
	})
})
