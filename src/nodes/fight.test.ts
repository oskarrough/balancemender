import {describe, it, expect, afterEach} from 'vitest'
import {settle} from '../test-setup'
import {GameLoop} from './game-loop'
import {unitsOf} from '../sim/run'
import {PeriodicAura} from './periodic-aura'
import type {Runt} from './enemies'
import {eligible} from './targeting'
import {Tank} from './party-units'
import {dungeonRegistry} from './dungeon'
import {FACTION} from './types'
import {unitRegistry} from './unit-registry'

/**
 * One spawn door. Whatever adds a unit — boot, a room, the dev console, a simulation —
 * ends up in `Fight.spawn()`, so these assertions hold for all of them. A room supplies each
 * side; an unqualified spawn uses the class default.
 */

let game!: GameLoop
afterEach(() => game.disconnect())

const names = () => game.fight.units.map((unit) => unit.name)

describe('Fight.spawn', () => {
	// `unitId` too, because a minified build mangles `constructor.name` and nothing else would say so.
	it('builds the fight from a room, player included', () => {
		game = new GameLoop({party: ['Tank'], enemies: ['Runt']})
		expect(names()).toEqual(['Oak', 'Player', 'Runt'])
		expect(game.fight.units.map((u) => u.unitId)).toEqual(['Tank', 'Player', 'Runt'])
		expect(game.party[0]).toBeInstanceOf(Tank)
	})

	it('keeps every tank in a room instead of resolving one special tank', () => {
		game = new GameLoop({party: ['Tank', 'Tank'], enemies: []})
		expect(game.party.filter((unit) => unit instanceof Tank)).toHaveLength(2)
	})

	it('uses the class faction when no side is given', () => {
		game = new GameLoop({party: [], enemies: []})
		game.fight.spawn('Tank')
		game.fight.spawn('Haruk')
		expect(game.party.map((u) => u.name)).toEqual(['Player', 'Oak'])
		expect(game.enemies.map((u) => u.name)).toEqual(['Haruk'])
	})

	it('uses an explicit side without changing the class default', () => {
		game = new GameLoop({party: [], enemies: []})
		const enemyTank = game.fight.spawn('Tank', FACTION.ENEMY)
		const partyHaruk = game.fight.spawn('Haruk', FACTION.PARTY)

		expect(enemyTank).toMatchObject({unitId: 'Tank', faction: FACTION.ENEMY})
		expect(partyHaruk).toMatchObject({unitId: 'Haruk', faction: FACTION.PARTY})
		expect(game.party).toContain(partyHaruk)
		expect(game.enemies).toContain(enemyTank)
		expect(partyHaruk.threat).toBeUndefined()
		expect(enemyTank.threat?.get(game.player)).toBe(0)
		expect(enemyTank.threat?.get(partyHaruk)).toBe(0)
		expect(unitRegistry.Tank.faction).toBe(FACTION.PARTY)
		expect(unitRegistry.Haruk.faction).toBe(FACTION.ENEMY)
	})

	it('keeps threat targeting when a threat-driven class joins the party side', () => {
		game = new GameLoop({party: [], enemies: []})
		const runt = game.fight.spawn('Runt', FACTION.PARTY)
		const tank = game.fight.spawn('Tank', FACTION.ENEMY)
		const haruk = game.fight.spawn('Haruk', FACTION.ENEMY)

		expect(runt.threat?.get(tank)).toBe(0)
		expect(runt.threat?.get(haruk)).toBe(0)
		runt.threat!.set(tank, 1)
		runt.threat!.set(haruk, 2)
		expect(runt.targeting?.pick('enemy')).toBe(haruk)
	})

	it('uses room rosters as sides even when classes default opposite', () => {
		game = new GameLoop({party: ['Haruk'], enemies: ['Tank']})
		const haruk = game.party.find((unit) => unit.unitId === 'Haruk')!
		const tank = game.enemies[0]

		expect(haruk.faction).toBe(FACTION.PARTY)
		expect(tank.faction).toBe(FACTION.ENEMY)
		expect(haruk.threat).toBeUndefined()
		expect(tank.threat?.get(haruk)).toBe(0)
		expect(tank.threat?.get(game.player)).toBe(0)
		expect(game.party.filter((unit) => unit.unitId === 'Player')).toHaveLength(1)
	})

	it('keeps every authored room roster on its side and adds one Player', async () => {
		game = new GameLoop({party: [], enemies: []})

		for (const dungeon of Object.values(dungeonRegistry)) {
			for (const room of dungeon.rooms) {
				game.enter(room)
				await settle()

				expect(game.party.every((unit) => unit.faction === FACTION.PARTY)).toBe(true)
				expect(game.enemies.every((unit) => unit.faction === FACTION.ENEMY)).toBe(true)
				expect(game.party.filter((unit) => unit.unitId === 'Player')).toHaveLength(1)
				expect(game.party.filter((unit) => unit !== game.player).map((unit) => unit.unitId)).toEqual(room.party ?? [])
				expect(game.enemies.map((unit) => unit.unitId)).toEqual(room.enemies ?? [])
			}
		}
	})

	it('numbers duplicates as they come and go, not just those in the starting room', () => {
		game = new GameLoop({party: [], enemies: ['Runt']})
		expect(names()).toContain('Runt')

		game.fight.spawn('Runt')
		expect(names()).toContain('Runt 1')
		expect(names()).toContain('Runt 2')

		game.fight.remove(game.enemies[0].id)
		expect(game.enemies.map((u) => u.name)).toEqual(['Runt'])
	})

	it('is the same door the dev console spawns through', () => {
		game = new GameLoop({party: [], enemies: []})
		const result = game.perform({type: 'spawn', unit: 'Haruk'})
		expect(result.ok).toBe(true)
		expect(game.enemies.map((u) => u.unitId)).toEqual(['Haruk'])
	})
})

/**
 * One death door. `Unit` routes every death to `Fight.onDeath()`, which stops the unit
 * without taking it out of the fight — see the comment there for why the dead stay in the arrays.
 */
describe('death', () => {
	it('keeps the fallen in the fight, so the report can still draw them', async () => {
		game = new GameLoop({party: [], enemies: ['Runt', 'Runt']})
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
		const tankGame = new GameLoop({party: ['Tank'], enemies: ['Runt']})
		game = tankGame
		await settle()
		const wolf = tankGame.enemies[0] as Runt
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

		expect(tankGame.perform({type: 'use', ability: 'Mend', target: tank.id}).ok).toBe(true)
		await settle()
		expect(tankGame.player.currentAbility).toBeDefined()
		expect(tankGame.player.gcd).toBeDefined()
		const gcd = tankGame.player.gcd!

		tankGame.player.health.set(0)
		await settle()
		expect(tankGame.player.currentAbility).toBeUndefined()
		expect(tankGame.player.gcd).toBeUndefined()
		expect(gcd.done).toBe(true)
		expect(tankGame.tasks).not.toContain(gcd)

		tank.health.set(0)
		await settle()
		expect(tank.auras.size).toBe(0)
	})

	it('lets the fallen come back, rather than refilling an inert corpse', async () => {
		const tankGame = new GameLoop({party: ['Tank'], enemies: ['Runt']})
		game = tankGame
		await settle()
		const wolf = tankGame.enemies[0] as Runt

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
		game = new GameLoop({party: [], enemies: ['Haruk']})
		game.restart()
		expect(game.enemies.map((u) => u.name)).toEqual(['Haruk'])
	})

	it('clears the combat log so the next fight is not read on top of the last one', () => {
		game = new GameLoop({party: [], enemies: ['Runt']})
		game.combatLog.add({timestamp: 1, eventType: 'SPELL_DAMAGE', value: 50})
		expect(game.combatLog.events.length).toBeGreaterThan(0)

		game.restart()
		expect(game.combatLog.events).toHaveLength(0)
	})
})
