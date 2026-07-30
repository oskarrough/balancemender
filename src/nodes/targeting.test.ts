import {describe, expect, it, afterEach} from 'vitest'
import {settle} from '../test-setup'
import {TankGameLoop as GameLoop} from '../test-fixtures'
import {prefer} from './targeting'

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

		expect(game.tank.targeting.pick('enemy')).toBe(shaman)
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
