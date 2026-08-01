import {afterEach, describe, expect, it} from 'vitest'
import {settle} from '../test-setup'
import {SimLoop} from '../sim/run'
import {Sling, Wind} from './attack'
import {TheRust, TheWhite} from './dungeon'
import {GameLoop} from './game-loop'
import {Clover, Gale, Tank, Wren} from './party-units'
import {FACTION} from './types'
import {unitIds, unitRegistry} from './unit-registry'

let game: GameLoop | undefined
afterEach(async () => {
	game?.disconnect()
	game = undefined
	await settle()
})

describe('Oak', () => {
	it('is the player-facing name for the Tank unit id', () => {
		game = new GameLoop({party: ['Tank'], enemies: []})
		const oak = game.party.find((unit) => unit.unitId === 'Tank')

		expect(oak).toBeInstanceOf(Tank)
		expect(oak).toMatchObject({name: 'Oak', unitId: 'Tank'})
	})
})

describe('Wren', () => {
	it('is a registered party unit with the authored kit and baseline', () => {
		game = new GameLoop({party: ['Wren'], enemies: []})
		const wren = game.party.find((unit) => unit.unitId === 'Wren')

		expect(unitRegistry.Wren).toBe(Wren)
		expect(unitIds(FACTION.PARTY)).toContain('Wren')
		expect(wren).toBeInstanceOf(Wren)
		expect(wren).toMatchObject({name: 'Wren', faction: FACTION.PARTY})
		expect(wren?.stats).toMatchObject({stamina: 140, strength: 26, agility: 15})
		expect(wren?.abilities).toEqual({Sling})
		expect((wren as Wren).slingCadence).toMatchObject({
			abilityId: 'Sling',
			delay: 500,
			interval: 1800,
		})
	})

	it('reconsiders every shot and targets the lowest-health living enemy', () => {
		game = new GameLoop({party: ['Wren'], enemies: ['Runt', 'Runt', 'Runt']})
		const wren = game.party.find((unit): unit is Wren => unit instanceof Wren)!
		const [first, second, third] = game.enemies
		first.health.set(80)
		second.health.set(20)
		third.health.set(50)

		expect(wren.targeting.pick('enemy')).toBe(second)
		third.health.set(10)
		expect(wren.targeting.pick('enemy')).toBe(third)

		third.health.set(0)
		expect(wren.targeting.pick('enemy')).toBe(second)
	})

	it('lands Sling as ordinary ranged physical damage with normal threat and combat logging', () => {
		game = new GameLoop({party: ['Wren'], enemies: ['Runt']}, 1)
		const wren = game.party.find((unit): unit is Wren => unit instanceof Wren)!
		const target = game.enemies[0]
		const before = target.health.current

		expect(Sling.tags).toEqual(['attack', 'ranged'])
		expect(Sling.school).toBe('physical')
		expect(Sling.effects[0]).toMatchObject({coefficient: 0.45})
		expect(Sling.threatMultiplier).toBe(1)
		expect(wren.useAbility('Sling', target).ok).toBe(true)

		const damage = before - target.health.current
		expect(damage).toBeGreaterThanOrEqual(19)
		expect(damage).toBeLessThanOrEqual(28)
		expect(target.threat?.get(wren)).toBe(damage)
		expect(game.combatLog.events).toContainEqual(
			expect.objectContaining({
				eventType: 'RANGE_DAMAGE',
				sourceId: wren.id,
				sourceName: 'Wren',
				targetId: target.id,
				abilityId: 'Sling',
				abilityName: 'Sling',
				value: damage,
			}),
		)
	})

	it('fires Sling on its own delayed cadence', async () => {
		game = new SimLoop({party: ['Wren'], enemies: ['Runt']}, 1)
		await settle()
		for (const unit of game.fight.units) {
			unit.health.max = 10_000
			unit.health.set(10_000)
		}

		for (let time = 0; time <= 4100; time += 100) game.runFrame(time)

		const wren = game.party.find((unit): unit is Wren => unit instanceof Wren)!
		expect(
			game.combatLog.events
				.filter(
					(event) => event.sourceId === wren.id && event.abilityId === 'Sling' && event.eventType === 'RANGE_DAMAGE',
				)
				.map((event) => event.time),
		).toEqual([500, 2300, 4100])
	})
})

describe('The Rust party', () => {
	it('brings Oak and Wren into every room from The dry bed onward', () => {
		expect(TheRust.rooms[0].name).toBe('The dry bed')
		for (const room of TheRust.rooms) expect(room.party).toEqual(['Tank', 'Wren'])
	})
})

describe('Gale', () => {
	it('is a registered party unit with the authored kit and baseline', () => {
		game = new GameLoop({party: ['Gale'], enemies: []})
		const gale = game.party.find((unit) => unit.unitId === 'Gale')

		expect(unitRegistry.Gale).toBe(Gale)
		expect(unitIds(FACTION.PARTY)).toContain('Gale')
		expect(gale).toBeInstanceOf(Gale)
		expect(gale).toMatchObject({name: 'Gale', faction: FACTION.PARTY})
		expect(gale?.stats).toMatchObject({stamina: 180, strength: 14, agility: 10})
		expect(gale?.abilities).toEqual({Sling, Wind})
		expect((gale as Gale).galeSlingCadence).toMatchObject({
			abilityId: 'Sling',
			delay: 500,
			interval: 2400,
		})
		expect((gale as Gale).galeWindCadence).toMatchObject({
			abilityId: 'Wind',
			delay: 3000,
			interval: 6000,
		})
	})

	it('plants Wind on every living party member, refreshing in place rather than stacking', async () => {
		game = new GameLoop({party: ['Tank', 'Wren', 'Clover', 'Gale'], enemies: ['Runt']}, 1)
		const gale = game.party.find((unit): unit is Gale => unit instanceof Gale)!
		// Gale's own strength sizes the wind: 14 strength → 28 attack power → +5.6 at coefficient 0.2.
		const before = game.party.map((unit) => unit.stats.strength)

		expect(gale.useAbility('Wind', game.party[0]).ok).toBe(true)
		await settle() // the aura mounts on the next microtask
		for (const [i, unit] of game.party.entries()) {
			// The wind carries the party, never its own maker — a self-buff would size the next
			// refresh from her buffed strength and compound with every cast.
			expect(unit.stats.strength).toBeCloseTo(before[i] + (unit === gale ? 0 : 5.6))
		}

		// A second wind refreshes the one standing rather than stacking: still +5.6, never +11.2.
		expect(gale.useAbility('Wind', game.party[0]).ok).toBe(true)
		await settle()
		for (const [i, unit] of game.party.entries()) {
			expect(unit.stats.strength).toBeCloseTo(before[i] + (unit === gale ? 0 : 5.6))
		}
	})

	it('keeps Wind on its own cadence while Gale stands', async () => {
		game = new SimLoop({party: ['Tank', 'Wren', 'Clover', 'Gale'], enemies: ['Runt']}, 1)
		await settle()
		for (const unit of game.fight.units) {
			unit.health.max = 10_000
			unit.health.set(10_000)
		}
		const gale = game.party.find((unit): unit is Gale => unit instanceof Gale)!
		const windEvents = (type: string) =>
			game!.combatLog.events.filter(
				(event) => event.sourceId === gale.id && event.abilityId === 'Wind' && event.eventType === type,
			)

		// The first wind at 3s: one application per living party member — the three companions
		// and the player — and never Gale herself.
		for (let time = 0; time <= 3100; time += 100) game.runFrame(time)
		await settle() // aura mounts log through the deferred lifecycle, so settle before asserting
		expect(windEvents('SPELL_AURA_APPLIED')).toHaveLength(4)
		expect(gale.stats.strength).toBe(14)

		// The 9s wind refreshes the first in place rather than stacking a second copy.
		for (let time = 3100; time <= 9100; time += 100) game.runFrame(time)
		await settle()
		expect(windEvents('SPELL_AURA_APPLIED')).toHaveLength(4)
		expect(windEvents('SPELL_AURA_REFRESH')).toHaveLength(4)
	})

	it('lets the wind die with them: the last Wind runs out its lifetime after Gale falls', async () => {
		game = new SimLoop({party: ['Tank', 'Wren', 'Clover', 'Gale'], enemies: ['Runt']}, 1)
		await settle()
		for (const unit of game.fight.units) {
			unit.health.max = 10_000
			unit.health.set(10_000)
		}
		const gale = game.party.find((unit): unit is Gale => unit instanceof Gale)!
		const [tank, wren, clover] = game.party as [Tank, Wren, Clover, Gale]

		gale.useAbility('Wind', tank)
		await settle()
		expect(tank.stats.strength).toBeCloseTo(tank.stats.base('strength') + 5.6)

		gale.health.set(0) // Gale falls — the cadence stops refreshing the wind.
		for (let time = 0; time <= 8100; time += 100) game.runFrame(time)
		await settle()

		for (const unit of [tank, wren, clover]) {
			expect(unit.stats.strength).toBe(unit.stats.base('strength'))
		}
	})
})

describe('The White party', () => {
	it('walks three bodies into The gliders and The ringing shelf, and Gale joins at The first water', () => {
		expect(TheWhite.rooms[0].name).toBe('The gliders')
		expect(TheWhite.rooms[0].party).toEqual(['Tank', 'Wren', 'Clover'])
		expect(TheWhite.rooms[1].name).toBe('The ringing shelf')
		expect(TheWhite.rooms[1].party).toEqual(['Tank', 'Wren', 'Clover'])
		expect(TheWhite.rooms[2].name).toBe('The first water')
		expect(TheWhite.rooms[2].party).toEqual(['Tank', 'Wren', 'Clover', 'Gale'])
		expect(TheWhite.rooms[3].name).toBe('The source')
		expect(TheWhite.rooms[3].party).toEqual(['Tank', 'Wren', 'Clover', 'Gale'])
	})
})
