import {afterEach, describe, expect, it} from 'vitest'
import {clearLogs, combatLogs} from '../combatlog'
import {SimLoop} from '../sim/run'
import {settle} from '../test-setup'
import {STAT} from './stats'
import {StatModifierAura} from './stat-modifier-aura'

class Fortitude extends StatModifierAura {
	static id = 'Fortitude'
	static name = 'Fortitude'
	static stat = STAT.STAMINA
	static modifier = 50
	static lifetime = 1000
}

let game!: SimLoop
afterEach(() => {
	clearLogs()
	game.disconnect()
})

describe('StatModifierAura', () => {
	it('modifies one stat for its lifetime, then restores its own contribution', async () => {
		// Keep the encounter running while the clock advances; an empty enemy side ends immediately.
		game = new SimLoop({party: ['Tank'], enemies: ['TinyWolf']})
		const originalHealth = game.tank.health.current
		// An applying ability can override the aura class's default with its own magnitude.
		new Fortitude(game.tank, game.player, 25)
		await settle()

		expect(game.tank.stats.stamina).toBe(325)
		expect(game.tank.health.max).toBe(325)
		expect(game.tank.health.current).toBe(originalHealth)

		game.runFrame(0)
		game.runFrame(Fortitude.lifetime + 1)
		await settle()

		expect(game.tank.stats.stamina).toBe(300)
		expect(game.tank.health.max).toBe(300)
		expect(combatLogs.map((event) => event.eventType)).toContain('SPELL_AURA_REMOVED')
	})

	it('refreshes without briefly retaining the superseded contribution', async () => {
		game = new SimLoop({party: ['Tank'], enemies: []})
		const first = new Fortitude(game.tank, game.player)
		await settle()
		const second = new Fortitude(game.tank, game.player)
		await settle()

		expect(first.superseded).toBe(true)
		expect(game.tank.stats.stamina).toBe(350)
		expect(game.tank.auras).toEqual(new Set([second]))
		expect(combatLogs.filter((event) => event.eventType === 'SPELL_AURA_REFRESH')).toHaveLength(1)
	})

	it('stacks separate copies and removes each by identity', async () => {
		class StackingFortitude extends Fortitude {
			static id = 'StackingFortitude'
			static maxStacks = 2
		}

		game = new SimLoop({party: ['Tank'], enemies: []})
		const first = new StackingFortitude(game.tank, game.player)
		const second = new StackingFortitude(game.tank, game.player)
		await settle()
		expect(game.tank.stats.stamina).toBe(400)

		first.disconnect()
		await settle()
		expect(game.tank.stats.stamina).toBe(350)

		second.disconnect()
		second.disconnect()
		await settle()
		expect(game.tank.stats.stamina).toBe(300)
	})

	it('updates mana and regeneration from intellect and spirit', async () => {
		class Insight extends StatModifierAura {
			static id = 'Insight'
			static name = 'Insight'
			static stat = STAT.INTELLECT
			static modifier = 10
		}
		class Meditation extends StatModifierAura {
			static id = 'Meditation'
			static name = 'Meditation'
			static stat = STAT.SPIRIT
			static modifier = 3
		}

		game = new SimLoop({party: ['Tank'], enemies: []})
		new Insight(game.player, game.player)
		new Meditation(game.player, game.player)
		await settle()

		expect(game.player.stats.intellect).toBe(50)
		expect(game.player.mana.max).toBe(750)
		expect(game.player.mana.current).toBe(600)
		expect(game.player.mana.regen.regenRate).toBe(12)
	})
})
