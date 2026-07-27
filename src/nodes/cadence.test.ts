// @vitest-environment happy-dom
import {describe, it, expect, beforeEach} from 'vitest'
import {GameLoop} from './game-loop'
import {WolfShaman, Mend} from './enemies'
import {Cadence} from './cadence'
import {SpellCast} from './spell-cast'
import type {Character} from './character'
import {combatLogs, clearLogs} from '../combatlog'

/**
 * Casting is not a player capability that enemies borrow — it is a `Character` one. What the
 * player has that a wolf does not is a keyboard and an `Autopilot`; the cast itself, its global
 * cooldown, its cast bar and its seven refusals are the same code for both.
 */

const step = () => Promise.resolve()
/**
 * Enough microtasks for a cast to finish arriving. A `Spell` mounts on one, and the
 * `GlobalCooldown` it creates mounts on the next — so a test that casts and then tears the game
 * down one step later leaves the cooldown mounting into a tree whose `root` has already been
 * reset. It throws outside any test, as an unhandled rejection vitest reports separately from
 * the passing run it came from.
 */
const settle = async () => {
	await step()
	await step()
}
/** The shaman's targeting is a Task; nudge it rather than waiting a frame for it. */
const retarget = (unit: Character) => (unit as WolfShaman).targetingTask.tick()

describe('an enemy that casts', () => {
	beforeEach(() => clearLogs())

	it('mends the ally that needs it most', async () => {
		const game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf', 'WolfShaman']})
		const [wolf, shaman] = game.enemies
		await step()

		wolf.health.set(wolf.health.max / 2)
		const before = wolf.health.current
		retarget(shaman)
		expect(shaman.currentTarget).toBe(wolf)

		const cast = shaman.castSpell('Mend')
		expect(cast.ok).toBe(true)
		if (!cast.ok) return
		await step()
		// The cast time is the Task's delay, so the heal lands when its one cycle completes.
		cast.value.tick()

		expect(wolf.health.current).toBeGreaterThan(before)
		expect(combatLogs.filter((e) => e.eventType === 'SPELL_HEAL' && e.sourceId === shaman.id)).toHaveLength(1)
		game.disconnect()
	})

	it('heals its own side, never the party', async () => {
		const game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf', 'WolfShaman']})
		const shaman = game.enemies[1]
		await step()

		game.tank.health.set(1)
		retarget(shaman)

		expect(shaman.currentTarget?.faction).toBe('enemy')
		expect(shaman.currentTarget).not.toBe(game.tank)
		game.disconnect()
	})

	it('follows the damage rather than settling on its first pick', async () => {
		const game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf', 'TinyWolf', 'WolfShaman']})
		const [first, second, shaman] = game.enemies
		await step()

		first.health.set(10)
		retarget(shaman)
		expect(shaman.currentTarget).toBe(first)

		// A healer that stuck with its choice would keep topping up a full health bar.
		first.health.set(first.health.max)
		second.health.set(10)
		retarget(shaman)
		expect(shaman.currentTarget).toBe(second)
		game.disconnect()
	})

	it('refuses for the same reasons the player would', async () => {
		const game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf', 'WolfShaman']})
		const [wolf, shaman] = game.enemies
		await step()

		shaman.currentTarget = undefined
		expect(shaman.castSpell('Mend')).toMatchObject({ok: false, error: `Can't cast without a target`})

		shaman.currentTarget = wolf
		expect(shaman.castSpell('Heal')).toMatchObject({ok: false})
		expect(shaman.castSpell('Heal').ok).toBe(false)

		// A wolf knows no spells at all, so its whole spellbook refuses.
		expect(game.enemies[0].castSpell('Mend')).toMatchObject({ok: false})
		game.disconnect()
	})

	it('spends a global cooldown like anyone else', async () => {
		const game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf', 'WolfShaman']})
		const [wolf, shaman] = game.enemies
		await step()
		shaman.currentTarget = wolf

		expect(shaman.castSpell('Mend').ok).toBe(true)
		await step()
		expect(shaman.gcd).toBeDefined()
		expect(SpellCast.whyNotAct(shaman)).toBe('global-cooldown')
		game.disconnect()
	})

	/** Enemies have no mana pool, so the cadence is the limiter — see `Mend`. */
	it('is limited by its interval and not by mana', async () => {
		const game = new GameLoop({party: ['Tank'], enemies: ['WolfShaman']})
		const shaman = game.enemies[0] as WolfShaman
		await step()

		expect(shaman.mana).toBeUndefined()
		expect(Mend.cost).toBe(0)
		expect(shaman.cadence.interval).toBeGreaterThan(0)
		game.disconnect()
	})

	it('does not try to cast while already casting', async () => {
		const game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf', 'WolfShaman']})
		const [wolf, shaman] = game.enemies
		await step()
		shaman.currentTarget = wolf

		const cadence = new Cadence(shaman)
		cadence.spell = 'Mend'
		await step()

		expect(cadence.shouldTick()).toBe(true)
		shaman.castSpell('Mend')
		expect(cadence.shouldTick()).toBe(false)
		await settle()
		game.disconnect()
	})
})
