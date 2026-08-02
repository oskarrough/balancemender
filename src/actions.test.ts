import {describe, it, expect, afterEach} from 'vitest'
import {settle} from './test-setup'
import {GameLoop} from './nodes/game-loop'
import {SimLoop} from './sim/run'
import {playerAbilities} from './nodes/registry'
import {dungeonRegistry} from './nodes/dungeon'
import type {RoomInput} from './nodes/fight'
import {emptyMalleable} from './malleable'
import {loadMalleable, saveMalleable} from './malleable-store'

/**
 * `game.perform()` is the only way anything changes a fight, so these assertions cover the
 * keyboard, the spell buttons, the dev console, the Balance Lab, the bot driver and agents at
 * once. Anything that stops being true here has grown a second path.
 */

let game!: GameLoop
afterEach(async () => {
	game.perform({type: 'resetBalance'})
	saveMalleable(emptyMalleable())
	game.disconnect()
	await settle()
})

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

	it('refuses a tune the value rules reject, naming the rule', () => {
		game = new GameLoop({party: [], enemies: []})
		expect(game.perform({type: 'tune', of: 'unit', name: 'Tank', key: 'stamina', value: -5})).toMatchObject({
			ok: false,
			error: 'unit values must be at least 0, got -5',
		})
		expect(game.perform({type: 'tune', of: 'ability', name: 'Mend', key: 'cost', value: Infinity})).toMatchObject({
			ok: false,
		})
	})

	it('accepts each balance surface and refuses unknown or invalid rows', () => {
		game = new GameLoop({party: [], enemies: []})
		expect(game.perform({type: 'tune', of: 'ability', name: 'Mend', key: 'cost', value: 61})).toEqual({
			ok: true,
			value: 61,
		})
		expect(game.perform({type: 'tune', of: 'effect', name: 'Renew.renew', key: 'coefficient', value: 1.1})).toEqual({
			ok: true,
			value: 1.1,
		})
		expect(game.perform({type: 'tune', of: 'cadence', name: 'NipCadence', key: 'interval', value: 1700})).toEqual({
			ok: true,
			value: 1700,
		})
		expect(game.perform({type: 'tune', of: 'aura', name: 'Renew', key: 'interval', value: 2100})).toEqual({
			ok: true,
			value: 2100,
		})
		expect(game.perform({type: 'tune', of: 'rule', name: 'Condition', key: 'injured', value: 30})).toEqual({
			ok: true,
			value: 30,
		})

		expect(
			game.perform({type: 'tune', of: 'effect', name: 'Missing.damage', key: 'coefficient', value: 1}),
		).toMatchObject({
			ok: false,
			error: 'Unknown effect: Missing.damage',
		})
		expect(
			game.perform({type: 'tune', of: 'cadence', name: 'MissingCadence', key: 'interval', value: 1}),
		).toMatchObject({
			ok: false,
			error: 'Unknown cadence: MissingCadence',
		})
		expect(game.perform({type: 'tune', of: 'aura', name: 'MissingAura', key: 'interval', value: 1})).toMatchObject({
			ok: false,
			error: 'Unknown aura: MissingAura',
		})
		expect(game.perform({type: 'tune', of: 'rule', name: 'MissingRule', key: 'injured', value: 1})).toMatchObject({
			ok: false,
			error: 'Unknown rule: MissingRule',
		})

		expect(
			game.perform({type: 'tune', of: 'effect', name: 'Renew.renew', key: 'coefficient', value: Infinity}),
		).toMatchObject({
			ok: false,
			error: 'Balance values must be finite, got Infinity',
		})
		expect(game.perform({type: 'tune', of: 'aura', name: 'Renew', key: 'interval', value: -1})).toMatchObject({
			ok: false,
			error: 'aura values must be at least 0, got -1',
		})
		expect(game.perform({type: 'tune', of: 'rule', name: 'Condition', key: 'injured', value: -1})).toMatchObject({
			ok: false,
			error: 'rule values must be at least 0, got -1',
		})
	})

	it('casts on the target it was given without moving what the player has selected', async () => {
		game = new GameLoop({party: ['Tank'], enemies: []})
		const tank = game.party[0]
		const selected = game.player.selectedTarget
		expect(selected).not.toBe(tank)

		expect(game.perform({type: 'use', ability: 'Mend', target: tank.id}).ok).toBe(true)
		expect(game.player.currentAbility?.target).toBe(tank)
		expect(game.player.selectedTarget).toBe(selected)
		// Let the spell finish mounting before tearing the loop down — its global cooldown
		// mounts in a microtask, and a node that mounts into a disconnected root throws.
		await settle()
	})

	it('selects a target and clears the selection', () => {
		game = new GameLoop({party: [], enemies: ['Runt']})
		const target = game.enemies[0]

		expect(game.perform({type: 'target', unit: target.id})).toMatchObject({ok: true})
		expect(game.player.selectedTarget).toBe(target)

		expect(game.perform({type: 'target'})).toMatchObject({ok: true})
		expect(game.player.selectedTarget).toBeUndefined()
	})

	it('does not start a cast when the target is bad', () => {
		game = new GameLoop({party: [], enemies: []})
		expect(game.perform({type: 'use', ability: 'Mend', target: 'nope'}).ok).toBe(false)
		expect(game.player.currentAbility).toBeUndefined()
	})

	it('charges Steep even when the player cancels the cast', async () => {
		game = new GameLoop({party: [], enemies: []})
		const before = game.player.mana.current
		expect(game.perform({type: 'use', ability: 'Steep'}).ok).toBe(true)
		await settle()
		expect(game.perform({type: 'interrupt'}).ok).toBe(true)
		// The brew is committed at cast start — a free self-cancel would be an infinite heal (#81).
		expect(game.player.mana.current).toBe(before - 60)
		await settle()
	})

	it('refuses to interrupt when nothing is being cast', async () => {
		game = new GameLoop({party: [], enemies: []})
		expect(game.perform({type: 'interrupt'})).toMatchObject({ok: false})

		game.perform({type: 'use', ability: 'Mend'})
		expect(game.perform({type: 'interrupt'}).ok).toBe(true)
		expect(game.player.currentAbility).toBeUndefined()
		await settle()
	})

	it('logs the casts it refuses, with the reason', () => {
		game = new GameLoop({party: ['Tank'], enemies: []})
		game.perform({type: 'use', ability: 'Fireball'})
		game.player.mana?.set(0)
		game.perform({type: 'use', ability: 'Mend', target: game.party[0].id})

		const failed = game.combatLog.events.filter((event) => event.eventType === 'SPELL_CAST_FAILED')
		expect(failed).toEqual([
			expect.objectContaining({abilityId: 'Fireball', extraInfo: 'missing-ability'}),
			expect.objectContaining({abilityId: 'Mend', extraInfo: 'missing-mana'}),
		])
	})

	it('retunes the units already fighting, matched by id and not by class name', () => {
		game = new GameLoop({party: ['Tank'], enemies: []})
		expect(game.perform({type: 'tune', of: 'unit', name: 'Tank', key: 'stamina', value: 50}).ok).toBe(true)
		// A minified build mangles `constructor.name`; `unitId` is what makes this reach anyone.
		expect(game.party[0].health.max).toBe(50)
		expect(game.party[0].health.current).toBe(50)

		expect(game.perform({type: 'resetBalance'})).toMatchObject({ok: true})
	})

	it('resets the balance and retunes the units already fighting', () => {
		game = new GameLoop({party: ['Tank'], enemies: []})
		game.perform({type: 'tune', of: 'unit', name: 'Tank', key: 'stamina', value: 50})
		expect(game.party[0].health.max).toBe(50)

		expect(game.perform({type: 'resetBalance'})).toMatchObject({ok: true})

		// The class is back at its default, and so is the unit that copied it.
		expect(game.party[0].health.max).toBe(300)
	})

	it('spawns and removes through the fight door', () => {
		game = new GameLoop({party: [], enemies: []})
		const spawned = game.perform({type: 'spawn', unit: 'Haruk'})
		expect(spawned.ok).toBe(true)
		expect(game.enemies).toHaveLength(1)

		expect(game.perform({type: 'remove', unit: game.enemies[0].id}).ok).toBe(true)
		expect(game.enemies).toHaveLength(0)
	})

	it('refuses an unknown spawn id instead of throwing', () => {
		game = new GameLoop({party: [], enemies: []})
		expect(game.perform({type: 'spawn', unit: 'Hydra' as never})).toMatchObject({
			ok: false,
			error: 'Unknown unit: Hydra',
		})
		expect(game.enemies).toHaveLength(0)
		// The player is always there; the point is that nothing else joined.
		expect(game.party).toHaveLength(1)
	})

	it('heals every party member to full', () => {
		game = new GameLoop({party: ['Tank'], enemies: []})
		for (const member of game.party) member.health.set(1)

		expect(game.perform({type: 'healParty'})).toMatchObject({ok: true})
		for (const member of game.party) expect(member.health.current).toBe(member.health.max)
	})

	it('kills units, refuses unknown ids, and respects party god mode', async () => {
		game = new GameLoop({party: ['Tank'], enemies: ['Runt']})
		const enemy = game.enemies[0]
		const player = game.player

		expect(game.perform({type: 'kill', unit: 'nope'})).toMatchObject({
			ok: false,
			error: 'No unit with id nope',
		})
		expect(game.perform({type: 'kill', unit: enemy.id})).toMatchObject({ok: true})
		expect(enemy.alive).toBe(false)

		expect(game.perform({type: 'set', key: 'godMode', value: true})).toMatchObject({ok: true})
		expect(game.perform({type: 'kill', unit: player.id})).toMatchObject({
			ok: false,
			error: 'God mode is on — nothing in the party can die',
		})
		expect(player.alive).toBe(true)
		await settle()
	})

	it('wipes a faction, but refuses to wipe the party in god mode', async () => {
		game = new GameLoop({party: ['Tank'], enemies: ['Runt', 'Haruk']})
		expect(game.perform({type: 'wipe', faction: 'enemy'})).toMatchObject({ok: true})
		expect(game.enemies.every((unit) => !unit.alive)).toBe(true)

		expect(game.perform({type: 'set', key: 'godMode', value: true})).toMatchObject({ok: true})
		expect(game.perform({type: 'wipe', faction: 'party'})).toMatchObject({
			ok: false,
			error: 'God mode is on — nothing in the party can die',
		})
		expect(game.party.every((unit) => unit.alive)).toBe(true)
		await settle()
	})

	it('sets globals, with the side effect the panel and the console both expected', () => {
		game = new GameLoop({party: [], enemies: []})
		game.player.mana!.set(10)

		expect(game.perform({type: 'set', key: 'infiniteMana', value: true})).toEqual({ok: true, value: true})
		expect(game.infiniteMana).toBe(true)
		expect(game.player.mana!.current).toBe(game.player.mana!.max)

		expect(game.perform({type: 'set', key: 'gcd', value: 900})).toEqual({ok: true, value: 900})
		expect(game.gcd).toBe(900)

		expect(game.perform({type: 'set', key: 'godMode', value: true})).toEqual({ok: true, value: true})
		expect(game.godMode).toBe(true)

		expect(game.perform({type: 'set', key: 'muted', value: false})).toEqual({ok: true, value: false})
		expect(game.muted).toBe(false)
		expect(game.audio.muted).toBe(false)
	})

	it('pauses and resumes, refusing redundant running states and logging both changes', async () => {
		game = new GameLoop({party: [], enemies: []})
		await settle()

		expect(game.perform({type: 'running', value: false})).toEqual({ok: true, value: false})
		expect(game.running).toBe(false)
		expect(game.perform({type: 'running', value: false})).toEqual({ok: false, error: 'Already paused'})

		expect(game.perform({type: 'running', value: true})).toEqual({ok: true, value: true})
		expect(game.running).toBe(true)
		expect(game.perform({type: 'running', value: true})).toEqual({ok: false, error: 'Already running'})

		expect(game.combatLog.events.filter((event) => event.eventType.startsWith('GAME_'))).toEqual([
			expect.objectContaining({eventType: 'GAME_PAUSE'}),
			expect.objectContaining({eventType: 'GAME_RESUME'}),
		])
	})
})

describe('navigation actions', () => {
	it('enters a one-off room', async () => {
		game = new GameLoop({party: [], enemies: []})
		await settle()

		expect(game.perform({type: 'enter', room: {party: ['Tank'], enemies: ['Runt'], name: 'arena'}})).toMatchObject({
			ok: true,
		})
		await settle()

		expect(game.dungeonRun).toBeUndefined()
		expect(game.fight.room.name).toBe('arena')
		expect(game.enemies[0].unitId).toBe('Runt')
	})

	it.each([
		{party: ['Player'], enemies: []},
		{party: [], enemies: ['Player']},
	] satisfies RoomInput[])('refuses Player in a room roster before entering (%#)', async (room) => {
		game = new GameLoop({party: [], enemies: ['Runt']})
		await settle()
		const currentFight = game.fight
		game.dungeonRun = {dungeon: dungeonRegistry.TheGreen, room: 0, times: []}
		const currentRun = game.dungeonRun

		expect(game.perform({type: 'enter', room})).toEqual({
			ok: false,
			error: 'Player is added automatically and cannot be listed in a room',
		})
		expect(game.fight).toBe(currentFight)
		expect(game.dungeonRun).toBe(currentRun)
	})

	it('accepts a room roster that does not list Player', async () => {
		game = new GameLoop({party: [], enemies: []})
		await settle()
		const room = {party: ['Haruk'], enemies: ['Tank']} satisfies RoomInput

		expect(game.perform({type: 'enter', room})).toMatchObject({ok: true})
		await settle()
		expect(game.fight.room).toBe(room)
	})

	it('enters Malleable paused with its saved composition', async () => {
		saveMalleable({version: 1, party: ['Haruk'], enemies: ['Tank', 'Runt']})
		game = new GameLoop({party: [], enemies: []})
		await settle()

		expect(game.perform({type: 'enterMalleable'})).toMatchObject({ok: true})
		await settle()

		expect(game.malleable).toBe(true)
		expect(game.running).toBe(false)
		expect(game.party.map((unit) => unit.unitId)).toEqual(['Haruk', 'Player'])
		expect(game.enemies.map((unit) => unit.unitId)).toEqual(['Tank', 'Runt'])
	})

	it('adds Malleable units to either side and refuses Player', async () => {
		game = new GameLoop({party: [], enemies: []})
		await settle()
		game.perform({type: 'enterMalleable'})
		await settle()

		expect(game.perform({type: 'malleableAdd', side: 'party', unit: 'Runt'})).toMatchObject({ok: true})
		expect(game.party.at(-1)?.unitId).toBe('Runt')
		expect(game.perform({type: 'malleableAdd', side: 'enemy', unit: 'Tank'})).toMatchObject({ok: true})
		expect(game.enemies.at(-1)?.unitId).toBe('Tank')
		expect(game.perform({type: 'malleableAdd', side: 'enemy', unit: 'Player'})).toEqual({
			ok: false,
			error: 'Player is added automatically and cannot be added to Malleable',
		})
		expect(loadMalleable()).toEqual({version: 1, party: ['Runt'], enemies: ['Tank']})
	})

	it('removes a Malleable unit but never the designated Player', async () => {
		saveMalleable({version: 1, party: ['Runt'], enemies: []})
		game = new GameLoop({party: [], enemies: []})
		await settle()
		game.perform({type: 'enterMalleable'})
		await settle()

		expect(game.perform({type: 'malleableRemove', unit: game.player.id})).toEqual({
			ok: false,
			error: 'The designated Player cannot be removed',
		})
		expect(game.perform({type: 'malleableRemove', unit: game.party[0].id})).toMatchObject({ok: true})
		expect(loadMalleable().party).toEqual([])
		expect(game.party).toEqual([game.player])
	})

	it('restarts Malleable from the autosaved composition and keeps it paused', async () => {
		game = new GameLoop({party: [], enemies: []})
		await settle()
		game.perform({type: 'enterMalleable'})
		await settle()
		game.perform({type: 'malleableAdd', side: 'enemy', unit: 'Runt'})
		const previous = game.enemies[0]
		game.elapsedTime = 5000

		expect(game.perform({type: 'restart'})).toMatchObject({ok: true})
		await settle()

		expect(game.malleable).toBe(true)
		expect(game.running).toBe(false)
		expect(game.elapsedTime).toBe(0)
		expect(game.enemies.map((unit) => unit.unitId)).toEqual(['Runt'])
		expect(game.enemies[0]).not.toBe(previous)
	})

	it('starts a known dungeon and refuses an unknown one', async () => {
		game = new GameLoop({party: [], enemies: []})
		await settle()

		expect(game.perform({type: 'startDungeon', dungeon: 'NoSuchDungeon'})).toEqual({
			ok: false,
			error: 'Unknown dungeon: NoSuchDungeon',
		})
		expect(game.perform({type: 'startDungeon', dungeon: 'TheGreen'})).toMatchObject({ok: true})
		await settle()

		expect(game.dungeonRun?.dungeon.id).toBe('TheGreen')
		expect(game.dungeonRun?.room).toBe(0)
	})

	it('restarts the current room', async () => {
		game = new GameLoop({party: [], enemies: ['Runt']})
		await settle()
		game.elapsedTime = 5000

		expect(game.perform({type: 'restart'})).toMatchObject({ok: true})
		await settle()

		expect(game.elapsedTime).toBe(0)
		expect(game.gameOver).toBe(false)
		expect(game.outcome).toBeUndefined()
		expect(game.enemies[0].unitId).toBe('Runt')
	})

	it('refuses next room until cleared, advances, and refuses past the dungeon finish', async () => {
		game = new SimLoop({party: [], enemies: []})
		await settle()

		expect(game.perform({type: 'nextRoom'})).toEqual({ok: false, error: 'Not in a dungeon'})
		expect(game.perform({type: 'startDungeon', dungeon: 'TheGreen'})).toMatchObject({ok: true})
		await settle()
		expect(game.perform({type: 'nextRoom'})).toEqual({ok: false, error: 'The room is not cleared yet'})

		let frame = 1
		for (let room = 0; room < 4; room++) {
			expect(game.perform({type: 'running', value: true})).toMatchObject({ok: true})
			expect(game.perform({type: 'wipe', faction: 'enemy'})).toMatchObject({ok: true})
			game.runFrame(frame++)
			await settle()
			expect(game.gameOver).toBe(true)
			expect(game.outcome).toBe('victory')

			expect(game.perform({type: 'nextRoom'})).toMatchObject({ok: true})
			await settle()
		}

		expect(game.dungeonRun?.room).toBe(4)
		expect(game.perform({type: 'running', value: true})).toMatchObject({ok: true})
		expect(game.perform({type: 'wipe', faction: 'enemy'})).toMatchObject({ok: true})
		game.runFrame(frame)
		await settle()
		expect(game.perform({type: 'nextRoom'})).toEqual({ok: false, error: 'The dungeon is finished'})
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
		expect(game.perform({type: 'use', ability: 'Mend', target: game.party[0].id}).ok).toBe(true)
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

		game.perform({type: 'use', ability: 'Mend', target: game.party[0].id})

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
