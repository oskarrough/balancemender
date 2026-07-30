import {describe, expect, it} from 'vitest'
import {STAT, Stats} from './stats'
import {GameLoop} from './game-loop'

describe('Stats', () => {
	it('resolves each base plus only that stat’s modifiers', () => {
		const stats = new Stats({stamina: 100, intellect: 10, strength: 8, agility: 7, spirit: 6})
		const fortitude = {}
		const frailty = {}
		const focus = {}

		stats.addModifier(fortitude, STAT.STAMINA, 30)
		stats.addModifier(frailty, STAT.STAMINA, -10)
		stats.addModifier(focus, STAT.INTELLECT, 5)

		expect(stats.stamina).toBe(120)
		expect(stats.intellect).toBe(15)
		expect(stats.strength).toBe(8)

		stats.setBase(STAT.STAMINA, 110)
		expect(stats.stamina).toBe(130)

		stats.removeModifier(fortitude)
		expect(stats.stamina).toBe(100)
		expect(stats.intellect).toBe(15)
	})

	it('derives the shipped resource values without changing the fight', () => {
		const game = new GameLoop({party: ['Tank'], enemies: ['Nakroth', 'TinyWolf', 'WolfShaman']})

		expect(game.player.stats).toMatchObject({
			stamina: 160,
			intellect: 40,
			strength: 5,
			agility: 10,
			spirit: 9,
		})
		expect(game.player.health.max).toBe(160)
		expect(game.player.mana.max).toBe(600)
		expect(game.player.mana.regen.regenRate).toBe(9)
		expect(game.tank.health.max).toBe(300)
		expect([game.tank.stats.strength, game.tank.stats.agility]).toEqual([20, 5])
		expect(game.enemies.map((unit) => unit.health.max)).toEqual([500, 240, 180])
		expect(
			game.enemies.map((unit) => [unit.stats.intellect, unit.stats.strength, unit.stats.agility, unit.stats.spirit]),
		).toEqual([
			[0, 25, 8, 0],
			[0, 10, 20, 0],
			[20, 5, 12, 5],
		])

		game.disconnect()
	})
})
