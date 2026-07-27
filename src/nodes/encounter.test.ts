// @vitest-environment happy-dom
import {describe, it, expect} from 'vitest'
import {GameLoop} from './game-loop'
import {unitsOf} from '../sim/run'
import {PeriodicAura} from './periodic-aura'
import type {TinyWolf} from './enemies'
import {eligible} from './targeting'

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

/**
 * One death door. `Unit` routes every death to `Encounter.onDeath()`, which stops the unit
 * without taking it out of the fight — see the comment there for why the dead stay in the arrays.
 */
describe('death', () => {
	/** vroum defers connect/disconnect to a microtask; two flushes settle a death. */
	const settle = async () => {
		await Promise.resolve()
		await Promise.resolve()
	}

	it('keeps the fallen in the fight, so the report can still draw them', async () => {
		const game = new GameLoop({party: [], enemies: ['TinyWolf', 'TinyWolf']})
		await settle()
		const [first, second] = game.enemies

		first.health.set(0)
		await settle()
		expect(first.alive).toBe(false)
		expect(game.enemies).toHaveLength(2)
		expect(unitsOf(game).map((unit) => unit.name)).toContain(first.name)
		expect(game.encounter.isEnemiesDefeated()).toBe(false)

		second.health.set(0)
		await settle()
		expect(game.encounter.isEnemiesDefeated()).toBe(true)
		game.disconnect()
	})

	/**
	 * Dying used to detach the unit from the tree, and `UnitFrame` calls `player.getTarget()`
	 * for every unit every frame — which reaches back up through `parent`. So the moment the
	 * player died, every render threw, the Game Over screen included.
	 */
	it('leaves the dead attached to the encounter, so the UI can still read them', async () => {
		const game = new GameLoop({party: ['Tank'], enemies: []})
		await settle()

		for (const member of game.party) member.health.set(0)
		await settle()

		expect(game.encounter.isPartyDefeated()).toBe(true)
		expect(game.player.parent).toBe(game.encounter)
		expect(() => game.player.getTarget()).not.toThrow()
		game.disconnect()
	})

	it('takes the dead out of targeting', async () => {
		const game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf']})
		await settle()
		const wolf = game.enemies[0] as TinyWolf
		wolf.currentTarget = game.tank

		game.tank.health.set(0)
		await settle()

		expect(wolf.getTarget()).toBeUndefined()
		expect(eligible(wolf, wolf.targeting.rule)).toEqual([game.player])
		game.disconnect()
	})

	it('stops what the dying unit was doing — its cast, its target, the auras on it', async () => {
		const game = new GameLoop({party: ['Tank'], enemies: []})
		await settle()
		const tank = game.tank

		new PeriodicAura(tank, game.player)
		await settle()
		expect(tank.auras.size).toBe(1)

		expect(game.perform({type: 'use', ability: 'Heal', target: tank.id}).ok).toBe(true)
		expect(game.player.currentAbility).toBeDefined()

		game.player.health.set(0)
		await settle()
		expect(game.player.currentAbility).toBeUndefined()
		expect(game.player.currentTarget).toBeUndefined()

		tank.health.set(0)
		await settle()
		expect(tank.auras.size).toBe(0)
		game.disconnect()
	})

	it('lets the fallen come back, rather than refilling an inert corpse', async () => {
		const game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf']})
		await settle()
		const wolf = game.enemies[0] as TinyWolf

		game.tank.health.set(0)
		await settle()
		expect(eligible(wolf, wolf.targeting.rule)).not.toContain(game.tank)

		game.perform({type: 'healParty'})
		await settle()
		expect(game.tank.alive).toBe(true)
		expect(game.tank.parent).toBe(game.encounter)
		expect(eligible(wolf, wolf.targeting.rule)).toContain(game.tank)
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
