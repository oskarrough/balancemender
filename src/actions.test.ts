import {describe, it, expect, afterEach} from 'vitest'
import {settle} from './test-setup'
import {GameLoop} from './nodes/game-loop'
import {SimLoop} from './sim/run'
import {playerAbilities} from './nodes/registry'

/**
 * `game.perform()` is the only way anything changes a fight, so these assertions cover the
 * keyboard, the spell buttons, the dev console, the Balance Lab, the bot driver and agents at
 * once. Anything that stops being true here has grown a second path.
 */

let game!: GameLoop
afterEach(() => game.disconnect())

describe('perform', () => {
	it('reports why it refused instead of failing silently', () => {
		game = new GameLoop({party: [], enemies: []})
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
	})

	it('casts on the target it was given without moving what the player has selected', async () => {
		game = new GameLoop({party: ['Tank'], enemies: []})
		const tank = game.party[0]
		const selected = game.player.selectedTarget
		expect(selected).not.toBe(tank)

		expect(game.perform({type: 'use', ability: 'Heal', target: tank.id}).ok).toBe(true)
		expect(game.player.currentAbility?.target).toBe(tank)
		expect(game.player.selectedTarget).toBe(selected)
		// Let the spell finish mounting before tearing the loop down — its global cooldown
		// mounts in a microtask, and a node that mounts into a disconnected root throws.
		await settle()
	})

	it('does not start a cast when the target is bad', () => {
		game = new GameLoop({party: [], enemies: []})
		expect(game.perform({type: 'use', ability: 'Heal', target: 'nope'}).ok).toBe(false)
		expect(game.player.currentAbility).toBeUndefined()
	})

	it('refuses to interrupt when nothing is being cast', async () => {
		game = new GameLoop({party: [], enemies: []})
		expect(game.perform({type: 'interrupt'})).toMatchObject({ok: false})

		game.perform({type: 'use', ability: 'Heal'})
		expect(game.perform({type: 'interrupt'}).ok).toBe(true)
		expect(game.player.currentAbility).toBeUndefined()
		await settle()
	})

	it('retunes the units already fighting, matched by id and not by class name', () => {
		game = new GameLoop({party: ['Tank'], enemies: []})
		expect(game.perform({type: 'tune', of: 'unit', name: 'Tank', key: 'stamina', value: 50}).ok).toBe(true)
		// A minified build mangles `constructor.name`; `unitId` is what makes this reach anyone.
		expect(game.party[0].health.max).toBe(50)
		expect(game.party[0].health.current).toBe(50)

		game.perform({type: 'resetBalance'})
	})

	it('spawns and removes through the fight door', () => {
		game = new GameLoop({party: [], enemies: []})
		const spawned = game.perform({type: 'spawn', unit: 'Haruk'})
		expect(spawned.ok).toBe(true)
		expect(game.enemies).toHaveLength(1)

		expect(game.perform({type: 'remove', unit: game.enemies[0].id}).ok).toBe(true)
		expect(game.enemies).toHaveLength(0)
	})

	it('sets globals, with the side effect the panel and the console both expected', () => {
		game = new GameLoop({party: [], enemies: []})
		game.player.mana!.set(10)

		game.perform({type: 'set', key: 'infiniteMana', value: true})
		expect(game.infiniteMana).toBe(true)
		expect(game.player.mana!.current).toBe(game.player.mana!.max)

		game.perform({type: 'set', key: 'gcd', value: 900})
		expect(game.gcd).toBe(900)
	})
})

/**
 * A refusal the player never sees is the same as the game ignoring the keyboard, which is what
 * casting with no mana used to be: `perform()` returned a reason and both the spell buttons and
 * the shortcut handler dropped it. Recording it on the game means a caller cannot forget to.
 */
describe('refusals', () => {
	it('remembers why and when, and says nothing about an action that went through', async () => {
		game = new GameLoop({party: ['Tank'], enemies: []})
		expect(game.perform({type: 'use', ability: 'Heal', target: game.party[0].id}).ok).toBe(true)
		expect(game.lastRefusal).toBeUndefined()

		game.elapsedTime = 5000
		game.perform({type: 'use', ability: 'Fireball'})

		expect(game.lastRefusal).toEqual({error: 'Ability Fireball not found in abilities', at: 5000})
		await settle()
	})

	// The reason has to be one a player can act on: "Not enough mana", never a generic failure.
	it('names the reason', () => {
		game = new GameLoop({party: ['Tank'], enemies: []})
		game.player.mana?.set(0)

		game.perform({type: 'use', ability: 'Heal', target: game.party[0].id})

		expect(game.lastRefusal?.error).toBe('Not enough mana')
	})

	// Stamped on the fight clock, which `enter()` sends back to zero. A leftover would
	// then sit in the new fight's future and never age out of the UI.
	it('forgets the last fight, whose clock no longer applies', () => {
		game = new GameLoop({party: ['Tank'], enemies: []})
		game.elapsedTime = 5000
		game.perform({type: 'use', ability: 'Fireball'})
		expect(game.lastRefusal).toBeDefined()

		game.perform({type: 'restart'})

		expect(game.lastRefusal).toBeUndefined()
	})
})

describe('every player ability', () => {
	// Renew once healed without ever logging a cast, because it overrode `tick()` instead of
	// `cast()`. Nothing but this stops the next ability doing the same.
	// An enemy has to be present, or the fight is already won and the loop stops before the cast lands.
	it.each(Object.keys(playerAbilities))('logs a completed cast: %s', async (ability) => {
		const sim = new SimLoop({party: ['Tank'], enemies: ['Runt']})
		game = sim
		await settle()
		const AbilityClass = playerAbilities[ability as keyof typeof playerAbilities]
		const target = AbilityClass.targets === 'enemy' ? sim.enemies[0] : sim.party[0]
		if (AbilityClass.targets === 'ally') sim.party[0].health.set(1)

		expect(sim.perform({type: 'use', ability, target: target.id}).ok).toBe(true)
		for (let time = 0; time < 5000; time += 16) {
			sim.runFrame(time)
			await settle()
		}

		const casts = sim.combatLog.events.filter((e) => e.eventType === 'SPELL_CAST_SUCCESS' && e.abilityId === ability)
		expect(casts).toHaveLength(1)
		await settle()
	})
})
