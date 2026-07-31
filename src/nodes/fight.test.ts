import {describe, it, expect, afterEach} from 'vitest'
import {settle} from '../test-setup'
import {GameLoop} from './game-loop'
import {unitsOf} from '../sim/run'
import {PeriodicAura} from './periodic-aura'
import type {TinyWolf} from './enemies'
import {eligible} from './targeting'
import {Tank} from './party-units'

/**
 * One spawn door. Whatever adds a unit — boot, a room, the dev console, a simulation —
 * ends up in `Fight.spawn()`, so these assertions hold for all of them.
 */

let game!: GameLoop
afterEach(() => game.disconnect())

const names = () => game.fight.units.map((unit) => unit.name)

describe('Fight.spawn', () => {
	// `unitId` too, because a minified build mangles `constructor.name` and nothing else would say so.
	it('builds the fight from a room, player included', () => {
		game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf']})
		expect(names()).toEqual(['Tank', 'Player', 'Tiny wolf'])
		expect(game.fight.units.map((u) => u.unitId)).toEqual(['Tank', 'Player', 'TinyWolf'])
		expect(game.party[0]).toBeInstanceOf(Tank)
	})

	it('keeps every tank in a room instead of resolving one special tank', () => {
		game = new GameLoop({party: ['Tank', 'Tank'], enemies: []})
		expect(game.party.filter((unit) => unit instanceof Tank)).toHaveLength(2)
	})

	it('routes a unit to its own faction rather than the caller picking a side', () => {
		game = new GameLoop({party: [], enemies: []})
		game.fight.spawn('Tank')
		game.fight.spawn('Nakroth')
		expect(game.party.map((u) => u.name)).toEqual(['Player', 'Tank'])
		expect(game.enemies.map((u) => u.name)).toEqual(['Nakroth the Destroyer'])
	})

	it('numbers duplicates as they come and go, not just those in the starting room', () => {
		game = new GameLoop({party: [], enemies: ['TinyWolf']})
		expect(names()).toContain('Tiny wolf')

		game.fight.spawn('TinyWolf')
		expect(names()).toContain('Tiny wolf 1')
		expect(names()).toContain('Tiny wolf 2')

		game.fight.remove(game.enemies[0].id)
		expect(game.enemies.map((u) => u.name)).toEqual(['Tiny wolf'])
	})

	it('is the same door the dev console spawns through', () => {
		game = new GameLoop({party: [], enemies: []})
		const result = game.perform({type: 'spawn', unit: 'Nakroth'})
		expect(result.ok).toBe(true)
		expect(game.enemies.map((u) => u.unitId)).toEqual(['Nakroth'])
	})
})

/**
 * One death door. `Unit` routes every death to `Fight.onDeath()`, which stops the unit
 * without taking it out of the fight — see the comment there for why the dead stay in the arrays.
 */
describe('death', () => {
	it('keeps the fallen in the fight, so the report can still draw them', async () => {
		game = new GameLoop({party: [], enemies: ['TinyWolf', 'TinyWolf']})
		await settle()
		const [first, second] = game.enemies

		first.health.set(0)
		await settle()
		expect(first.alive).toBe(false)
		expect(game.enemies).toHaveLength(2)
		expect(unitsOf(game).map((unit) => unit.name)).toContain(first.name)
		expect(game.fight.isEnemiesDefeated()).toBe(false)

		second.health.set(0)
		await settle()
		expect(game.fight.isEnemiesDefeated()).toBe(true)
	})

	/**
	 * Dying used to detach the unit from the tree, and `UnitFrame` reads `player.intendedTarget`
	 * for every unit every frame — which reaches back up through `parent`. So the moment the
	 * player died, every render threw, the Game Over screen included.
	 */
	it('leaves the dead attached to the fight, so the UI can still read them', async () => {
		game = new GameLoop({party: ['Tank'], enemies: []})
		await settle()

		for (const member of game.party) member.health.set(0)
		await settle()

		expect(game.fight.isPartyDefeated()).toBe(true)
		expect(game.player.parent).toBe(game.fight)
		expect(() => game.player.intendedTarget).not.toThrow()
	})

	it('takes the dead out of targeting', async () => {
		const tankGame = new GameLoop({party: ['Tank'], enemies: ['TinyWolf']})
		game = tankGame
		await settle()
		const wolf = tankGame.enemies[0] as TinyWolf
		// Let it settle on someone first — a wolf that never picked could not pick a corpse anyway.
		wolf.targeting.pick('enemy')

		tankGame.party[0].health.set(0)
		await settle()

		expect(eligible(wolf, 'enemy')).toEqual([tankGame.player])
		expect(wolf.targeting.pick('enemy')).toBe(tankGame.player)
	})

	it('stops what the dying unit was doing — its cast, the auras on it', async () => {
		const tankGame = new GameLoop({party: ['Tank'], enemies: []})
		game = tankGame
		await settle()
		const tank = tankGame.party[0]

		new PeriodicAura(tank, tankGame.player)
		await settle()
		expect(tank.auras.size).toBe(1)

		expect(tankGame.perform({type: 'use', ability: 'Heal', target: tank.id}).ok).toBe(true)
		expect(tankGame.player.currentAbility).toBeDefined()

		tankGame.player.health.set(0)
		await settle()
		expect(tankGame.player.currentAbility).toBeUndefined()

		tank.health.set(0)
		await settle()
		expect(tank.auras.size).toBe(0)
	})

	it('lets the fallen come back, rather than refilling an inert corpse', async () => {
		const tankGame = new GameLoop({party: ['Tank'], enemies: ['TinyWolf']})
		game = tankGame
		await settle()
		const wolf = tankGame.enemies[0] as TinyWolf

		tankGame.party[0].health.set(0)
		await settle()
		expect(eligible(wolf, 'enemy')).not.toContain(tankGame.party[0])

		tankGame.perform({type: 'healParty'})
		await settle()
		expect(tankGame.party[0].alive).toBe(true)
		expect(tankGame.party[0].parent).toBe(tankGame.fight)
		expect(eligible(wolf, 'enemy')).toContain(tankGame.party[0])
	})
})

describe('restart', () => {
	it('replays the room you were fighting, not the demo one', () => {
		game = new GameLoop({party: [], enemies: ['Nakroth']})
		game.restart()
		expect(game.enemies.map((u) => u.name)).toEqual(['Nakroth the Destroyer'])
	})

	it('clears the combat log so the next fight is not read on top of the last one', () => {
		game = new GameLoop({party: [], enemies: ['TinyWolf']})
		game.combatLog.add({timestamp: 1, eventType: 'SPELL_DAMAGE', value: 50})
		expect(game.combatLog.events.length).toBeGreaterThan(0)

		game.restart()
		expect(game.combatLog.events).toHaveLength(0)
	})
})
