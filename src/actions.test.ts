// @vitest-environment happy-dom
import {describe, it, expect, beforeEach} from 'vitest'
import {GameLoop} from './nodes/game-loop'
import {SimLoop} from './sim/run'
import {playerAbilities} from './nodes/registry'
import {combatLogs, clearLogs} from './combatlog'

/**
 * `game.perform()` is the only way anything changes a fight, so these assertions cover the
 * keyboard, the spell buttons, the dev console, the Balance Lab, the Autopilot and agents at
 * once. Anything that stops being true here has grown a second path.
 */

const flush = () => Promise.resolve()

describe('perform', () => {
	it('reports why it refused instead of failing silently', () => {
		const game = new GameLoop({party: [], enemies: []})
		expect(game.perform({type: 'use', ability: 'Fireball'})).toEqual({
			ok: false,
			error: 'Ability Fireball not found in abilities',
		})
		expect(game.perform({type: 'remove', unit: 'nope'})).toMatchObject({ok: false})
		expect(game.perform({type: 'target', unit: 'nope'})).toMatchObject({ok: false})
		expect(game.perform({type: 'tune', of: 'ability', name: 'Fireball', key: 'cost', value: 1})).toMatchObject({
			ok: false,
			error: 'Unknown ability: Fireball',
		})
		game.disconnect()
	})

	it('casting takes the target with it, so nobody has to set both', async () => {
		const game = new GameLoop({party: ['Tank'], enemies: []})
		const tank = game.tank
		expect(game.player.currentTarget).not.toBe(tank)

		expect(game.perform({type: 'use', ability: 'Heal', target: tank.id}).ok).toBe(true)
		expect(game.player.currentTarget).toBe(tank)
		expect(game.player.currentAbility?.name).toBe('Heal')
		// Let the spell finish mounting before tearing the loop down — its global cooldown
		// mounts in a microtask, and a node that mounts into a disconnected root throws.
		await flush()
		game.disconnect()
	})

	it('does not start a cast when the target is bad', () => {
		const game = new GameLoop({party: [], enemies: []})
		expect(game.perform({type: 'use', ability: 'Heal', target: 'nope'}).ok).toBe(false)
		expect(game.player.currentAbility).toBeUndefined()
		game.disconnect()
	})

	it('refuses to interrupt when nothing is being cast', async () => {
		const game = new GameLoop({party: [], enemies: []})
		expect(game.perform({type: 'interrupt'})).toMatchObject({ok: false})

		game.perform({type: 'use', ability: 'Heal'})
		expect(game.perform({type: 'interrupt'}).ok).toBe(true)
		expect(game.player.currentAbility).toBeUndefined()
		await flush()
		game.disconnect()
	})

	it('retunes the units already fighting, matched by id and not by class name', () => {
		const game = new GameLoop({party: ['Tank'], enemies: []})
		expect(game.perform({type: 'tune', of: 'unit', name: 'Tank', key: 'maxHealth', value: 50}).ok).toBe(true)
		// A minified build mangles `constructor.name`; `unitId` is what makes this reach anyone.
		expect(game.tank.health.max).toBe(50)
		expect(game.tank.health.current).toBe(50)

		game.perform({type: 'resetBalance'})
		game.disconnect()
	})

	it('spawns and removes through the encounter door', () => {
		const game = new GameLoop({party: [], enemies: []})
		const spawned = game.perform({type: 'spawn', unit: 'Nakroth'})
		expect(spawned.ok).toBe(true)
		expect(game.enemies).toHaveLength(1)

		expect(game.perform({type: 'remove', unit: game.enemies[0].id}).ok).toBe(true)
		expect(game.enemies).toHaveLength(0)
		game.disconnect()
	})

	it('sets globals, with the side effect the panel and the console both expected', () => {
		const game = new GameLoop({party: [], enemies: []})
		game.player.mana!.set(10)

		game.perform({type: 'set', key: 'infiniteMana', value: true})
		expect(game.infiniteMana).toBe(true)
		expect(game.player.mana!.current).toBe(game.player.mana!.max)

		game.perform({type: 'set', key: 'gcd', value: 900})
		expect(game.gcd).toBe(900)
		game.disconnect()
	})
})

/**
 * A refusal the player never sees is the same as the game ignoring the keyboard, which is what
 * casting with no mana used to be: `perform()` returned a reason and both the spell buttons and
 * the shortcut handler dropped it. Recording it on the game means a caller cannot forget to.
 */
describe('refusals', () => {
	it('remembers why, and when, so the UI can say so', () => {
		const game = new GameLoop({party: ['Tank'], enemies: []})
		expect(game.lastRefusal).toBeUndefined()

		game.elapsedTime = 5000
		game.perform({type: 'use', ability: 'Fireball'})

		expect(game.lastRefusal).toEqual({error: 'Ability Fireball not found in abilities', at: 5000})
		game.disconnect()
	})

	it('names the reason a player can act on, not a generic failure', () => {
		const game = new GameLoop({party: ['Tank'], enemies: []})
		game.player.mana?.set(0)

		game.perform({type: 'use', ability: 'Heal', target: game.tank.id})

		expect(game.lastRefusal?.error).toBe('Not enough mana')
		game.disconnect()
	})

	it('stays quiet when the action went through', async () => {
		const game = new GameLoop({party: ['Tank'], enemies: []})
		expect(game.perform({type: 'use', ability: 'Heal', target: game.tank.id}).ok).toBe(true)
		expect(game.lastRefusal).toBeUndefined()
		await flush()
		game.disconnect()
	})

	// Stamped on the fight clock, which `loadEncounter()` sends back to zero. A leftover would
	// then sit in the new fight's future and never age out of the UI.
	it('forgets the last fight, whose clock no longer applies', () => {
		const game = new GameLoop({party: ['Tank'], enemies: []})
		game.elapsedTime = 5000
		game.perform({type: 'use', ability: 'Fireball'})
		expect(game.lastRefusal).toBeDefined()

		game.perform({type: 'restart'})

		expect(game.lastRefusal).toBeUndefined()
		game.disconnect()
	})
})

describe('every player ability', () => {
	beforeEach(() => clearLogs())

	// Renew once healed without ever logging a cast, because it overrode `tick()` instead of
	// `cast()`. Nothing but this stops the next ability doing the same.
	// An enemy has to be present, or the fight is already won and the loop stops before the cast lands.
	it.each(Object.keys(playerAbilities))('logs a completed cast: %s', async (ability) => {
		const game = new SimLoop({party: ['Tank'], enemies: ['TinyWolf']})
		await flush()
		game.tank.health.set(1)

		expect(game.perform({type: 'use', ability, target: game.tank.id}).ok).toBe(true)
		for (let time = 0; time < 5000; time += 16) {
			game.runFrame(time)
			await flush()
		}

		const casts = combatLogs.filter((e) => e.eventType === 'SPELL_CAST_SUCCESS' && e.abilityId === ability)
		expect(casts).toHaveLength(1)
		game.disconnect()
		await flush()
	})
})
