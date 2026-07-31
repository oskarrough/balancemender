import {describe, expect, it, afterEach} from 'vitest'
import {settle} from '../test-setup'
import {GameLoop} from './game-loop'
import {prefer} from './targeting'
import {Tank} from './party-units'

let game!: GameLoop
afterEach(() => game.disconnect())

describe('healerFirst', () => {
	/**
	 * The whole of #51. A `WolfShaman` is spawned behind the wolves, and the tank used to take the
	 * first live enemy and stay there — so the shaman was reached only once every wolf was dead, and
	 * no wolf could die while it was healing them. Three units, unwinnable by every bot.
	 */
	it('reaches past the wolves in front for the one that can heal', async () => {
		game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf', 'TinyWolf', 'WolfShaman']})
		await settle()
		const shaman = game.enemies.at(-1)
		const tank = game.party.find((unit): unit is Tank => unit instanceof Tank)
		if (!tank) throw new Error('Room did not spawn its tank')

		expect(tank.targeting.pick('enemy')).toBe(shaman)
	})

	/**
	 * Why the rest of the sweep grid did not move when the tank changed its mind: with nobody to
	 * single out, this has to be the plain "whoever comes first" it replaced, switching never.
	 */
	it('is exactly first when nothing in the fight heals', async () => {
		game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf', 'TinyWolf']})
		await settle()
		const candidates = game.enemies

		expect(prefer.healerFirst.prefers(candidates)).toBe(prefer.first.prefers(candidates))
		expect(prefer.healerFirst.reconsiders(candidates[0], candidates)).toBe(false)
	})
})

describe('current target', () => {
	it('exposes the last live pick without choosing one for the UI', () => {
		game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf']})
		const wolf = game.enemies[0]

		expect(wolf.targeting?.current('enemy')).toBeUndefined()

		const target = wolf.targeting?.pick('enemy')

		expect(target).toBeDefined()
		expect(wolf.targeting?.current('enemy')).toBe(target)

		target?.health.set(0)

		expect(wolf.targeting?.current('enemy')).toBeUndefined()
	})
})

describe('player intended target', () => {
	it('keeps a living selection, then falls back through the living tanks', async () => {
		game = new GameLoop({party: ['Tank', 'Tank'], enemies: ['TinyWolf']})
		await settle()
		const [firstTank, secondTank] = game.party
		const enemy = game.enemies[0]
		expect(firstTank).toBeInstanceOf(Tank)
		expect(secondTank).toBeInstanceOf(Tank)

		game.player.selectedTarget = enemy
		expect(game.player.intendedTarget).toBe(enemy)

		game.player.selectedTarget = undefined
		expect(game.player.intendedTarget).toBe(firstTank)

		game.player.selectedTarget = firstTank
		firstTank.health.set(0)
		await settle()
		expect(game.player.intendedTarget).toBe(secondTank)
	})

	it('notices tanks entering and leaving the eligible allies', async () => {
		game = new GameLoop({party: [], enemies: []})
		await settle()
		game.player.selectedTarget = undefined
		expect(game.player.intendedTarget).toBe(game.player)

		const tank = game.fight.spawn('Tank')
		expect(game.player.intendedTarget).toBe(tank)

		tank.health.set(0)
		await settle()

		expect(game.player.intendedTarget).toBe(game.player)
	})
})
