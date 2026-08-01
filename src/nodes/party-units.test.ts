import {afterEach, describe, expect, it} from 'vitest'
import {settle} from '../test-setup'
import {SimLoop} from '../sim/run'
import {Sling} from './attack'
import {TheRust} from './dungeon'
import {GameLoop} from './game-loop'
import {Tank, Wren} from './party-units'
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
