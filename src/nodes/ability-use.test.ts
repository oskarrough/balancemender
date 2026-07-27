// @vitest-environment happy-dom
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
		expect(AbilityUse.whyNotUse(game.enemies[0], abilityRegistry.WolfBite, game.tank)).toBeUndefined()
		game.disconnect()
	})

	it('keeps the target rule in force while a cast is in flight', async () => {
		const game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf']})
		const enemy = game.enemies[0]
		enemy.health.set(10)
		game.player.currentTarget = game.tank
		const use = game.player.useAbility('Heal')
		expect(use.ok).toBe(true)
		if (!use.ok) return
		await Promise.resolve()

		game.player.currentTarget = enemy
		use.value.tick()
		expect(enemy.health.current).toBe(10)
		await Promise.resolve()
		game.disconnect()
	})

	it('holds one ability on its own cooldown', async () => {
		const game = new GameLoop({party: ['Tank'], enemies: []})
		const player = game.player
		expect(game.perform({type: 'tune', of: 'ability', name: 'Heal', key: 'cooldown', value: 8000}).ok).toBe(true)
		expect(game.perform({type: 'cast', spell: 'Heal', target: game.tank.id}).ok).toBe(true)
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
		expect(AbilityUse.whyNotUse(player, abilityRegistry.TankAttack, game.tank)).toBe('invalid-target')
		game.disconnect()
	})
})
