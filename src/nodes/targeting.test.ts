import {describe, expect, it} from 'vitest'
import {settle} from '../test-setup'
import {GameLoop} from './game-loop'
import {prefer} from './targeting'

describe('healerFirst', () => {
	/**
	 * The whole of #51. A `WolfShaman` is spawned behind the wolves, and the tank used to take the
	 * first live enemy and stay there — so the shaman was reached only once every wolf was dead, and
	 * no wolf could die while it was healing them. Three units, unwinnable by every bot.
	 */
	it('reaches past the wolves in front for the one that can heal', async () => {
		const game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf', 'TinyWolf', 'WolfShaman']})
		await settle()
		const shaman = game.enemies.at(-1)

		expect(game.tank.targeting.pick('enemy')).toBe(shaman)
		game.disconnect()
	})

	/**
	 * Why the rest of the sweep grid did not move when the tank changed its mind: with nobody to
	 * single out, this has to be the plain "whoever comes first" it replaced, switching never.
	 */
	it('is exactly first when nothing in the fight heals', async () => {
		const game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf', 'TinyWolf']})
		await settle()
		const candidates = game.enemies

		expect(prefer.healerFirst.prefers(candidates)).toBe(prefer.first.prefers(candidates))
		expect(prefer.healerFirst.reconsiders(candidates[0], candidates)).toBe(false)
		game.disconnect()
	})
})
