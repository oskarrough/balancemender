// @vitest-environment happy-dom
import {describe, it, expect} from 'vitest'
import {GameLoop} from './game-loop'

/**
 * One spawn door. Whatever adds a unit — boot, a roster, the dev console, a simulation —
 * ends up in `Encounter.spawn()`, so these assertions hold for all of them.
 */

const names = (game: GameLoop) => [...game.party, ...game.enemies].map((unit) => unit.name)

describe('Encounter.spawn', () => {
	it('builds the fight from a roster, player included', () => {
		const game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf']})
		expect(names(game)).toEqual(['Tank', 'Player', 'Tiny wolf'])
		expect(game.player).toBeDefined()
		expect(game.tank).toBeDefined()
		game.disconnect()
	})

	it('routes a unit to its own faction rather than the caller picking a side', () => {
		const game = new GameLoop({party: [], enemies: []})
		game.encounter.spawn('Tank')
		game.encounter.spawn('Nakroth')
		expect(game.party.map((u) => u.name)).toEqual(['Player', 'Tank'])
		expect(game.enemies.map((u) => u.name)).toEqual(['Nakroth the Destroyer'])
		game.disconnect()
	})

	it('records the registry id, which survives minification unlike constructor.name', () => {
		const game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf']})
		expect([...game.party, ...game.enemies].map((u) => u.unitId)).toEqual(['Tank', 'Player', 'TinyWolf'])
		game.disconnect()
	})

	it('renumbers duplicates spawned later, not just those in the starting roster', () => {
		const game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf']})
		expect(names(game)).toContain('Tiny wolf')

		game.encounter.spawn('TinyWolf')
		expect(names(game)).toContain('Tiny wolf 1')
		expect(names(game)).toContain('Tiny wolf 2')
		game.disconnect()
	})

	it('drops the numbering again when a duplicate is removed', () => {
		const game = new GameLoop({party: [], enemies: ['TinyWolf', 'TinyWolf']})
		const [first] = game.enemies
		expect(game.encounter.remove(first.id)).toBe(true)
		expect(game.enemies.map((u) => u.name)).toEqual(['Tiny wolf'])
		game.disconnect()
	})

	it('is the same door the dev console spawns through', () => {
		const game = new GameLoop({party: [], enemies: []})
		const result = game.perform({type: 'spawn', unit: 'Nakroth'})
		expect(result.ok).toBe(true)
		expect(game.enemies.map((u) => u.unitId)).toEqual(['Nakroth'])
		game.disconnect()
	})
})

describe('restart', () => {
	it('replays the roster you were fighting, not the demo one', () => {
		const game = new GameLoop({party: [], enemies: ['Nakroth']})
		game.restart()
		expect(game.enemies.map((u) => u.name)).toEqual(['Nakroth the Destroyer'])
		game.disconnect()
	})

	it('clears the combat log so the next fight is not read on top of the last one', async () => {
		const {combatLogs, logCombat} = await import('../combatlog')
		const game = new GameLoop({party: [], enemies: ['TinyWolf']})
		logCombat({timestamp: 1, eventType: 'SPELL_DAMAGE', value: 50})
		expect(combatLogs.length).toBeGreaterThan(0)

		game.restart()
		expect(combatLogs).toHaveLength(0)
		game.disconnect()
	})
})
