import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import {settle} from '../test-setup'
import {GameLoop} from './game-loop'
import {SimLoop} from '../sim/run'
import type {Aura} from './aura'
import {PeriodicAura} from './periodic-aura'
import {SavageBite} from './attack'
import {Renew} from './spells'
import {combatLogs, clearLogs} from '../combatlog'

/**
 * `maxStacks` is what stops "cast it again" from being the best button in the game. Renew is
 * instant and the GCD is 1500ms, so copies that stack are copies that multiply the best
 * heal-per-mana in the ladder by however fast you can press it.
 */

const aurasNamed = (unit: {auras: Set<Aura>}, name: string) =>
	[...unit.auras].filter((aura): aura is PeriodicAura => aura.name === name && aura instanceof PeriodicAura)

const auraEvents = (spell: string) =>
	combatLogs.filter((event) => event.eventType.startsWith('SPELL_AURA') && event.abilityName === spell)

let game!: GameLoop
beforeEach(() => clearLogs())
afterEach(() => game.disconnect())

describe('stack rule', () => {
	it('replaces rather than stacks by default, so a recast refreshes', async () => {
		game = new GameLoop({party: ['Tank'], enemies: []})

		new Renew(game.player, game.tank).land()
		await settle()
		const first = aurasNamed(game.tank, 'Renew')[0]
		first.tick()

		new Renew(game.player, game.tank).land()
		await settle()
		const after = aurasNamed(game.tank, 'Renew')

		expect(after).toHaveLength(1)
		expect(after[0]).not.toBe(first)
		expect(first.superseded).toBe(true)
	})

	it('keeps up to maxStacks copies and drops the one closest to expiring', async () => {
		game = new GameLoop({party: ['Tank'], enemies: []})

		class Lifebloom extends PeriodicAura {
			static name = 'Lifebloom'
			static total = 30
			static maxStacks = 3
		}

		const planted = []
		for (let i = 0; i < 4; i++) {
			planted.push(new Lifebloom(game.tank, game.player))
			await settle()
		}

		const stacks = aurasNamed(game.tank, 'Lifebloom')
		expect(stacks).toHaveLength(3)
		expect(stacks).toEqual(planted.slice(1))
		expect(planted[0].superseded).toBe(true)
	})

	it('counts casters separately, so two healers can each keep one up', async () => {
		game = new GameLoop({party: ['Tank'], enemies: []})

		new PeriodicAura(game.tank, game.player, 50)
		new PeriodicAura(game.tank, game.tank, 50)
		await settle()

		expect(aurasNamed(game.tank, 'Periodic')).toHaveLength(2)
	})

	it('logs a refresh instead of a removal, so the log never says an aura it still has fell off', async () => {
		game = new GameLoop({party: ['Tank'], enemies: []})

		new Renew(game.player, game.tank).land()
		await settle()
		new Renew(game.player, game.tank).land()
		await settle()

		expect(auraEvents('Renew').map((event) => event.eventType)).toEqual(['SPELL_AURA_APPLIED', 'SPELL_AURA_REFRESH'])
		expect(auraEvents('Renew')[0]).toMatchObject({sourceId: game.player.id, targetId: game.tank.id})
	})

	it('says how many are up once there is more than one', async () => {
		game = new GameLoop({party: ['Tank'], enemies: []})

		class Sunder extends PeriodicAura {
			static name = 'Sunder'
			static total = -10
			static maxStacks = 5
		}
		new Sunder(game.tank, game.player)
		await settle()
		new Sunder(game.tank, game.player)
		await settle()

		expect(auraEvents('Sunder').map((event) => event.extraInfo)).toEqual([undefined, '2 stacks'])
	})

	/**
	 * vroum's `disconnect()` queues `_runDestroy` unconditionally, so a second call runs teardown
	 * on a node whose `root` has already been reset to itself and throws out of `Task.destroy`.
	 * Auras are the node type several unrelated callers can reach — see `detached`.
	 */
	it('survives being disconnected twice', async () => {
		game = new GameLoop({party: ['Tank'], enemies: []})
		const aura = new PeriodicAura(game.tank, game.player, -10)
		await settle()

		expect(() => {
			aura.disconnect()
			aura.disconnect()
		}).not.toThrow()
		await settle()
	})
})

describe('tick timing', () => {
	it('waits one subclass interval before its first tick', async () => {
		class PatientAura extends PeriodicAura {
			static id = 'PatientAura'
			static name = 'Patient aura'
			static total = 10
			static interval = 2000
			static repeat = 2
		}

		const sim = new SimLoop({party: ['Tank'], enemies: ['TinyWolf']})
		game = sim
		await settle()
		new PatientAura(game.tank, game.player)
		await settle()
		const ticks = () => combatLogs.filter((event) => event.abilityId === 'PatientAura' && 'value' in event)

		sim.runFrame(0)
		sim.runFrame(PatientAura.interval - 1)
		expect(ticks()).toHaveLength(0)

		sim.runFrame(PatientAura.interval)
		expect(ticks()).toHaveLength(1)
		expect(ticks()[0].time).toBe(PatientAura.interval)
	})
})

describe('the wolf bleed', () => {
	it('opens a wound that later bites refresh rather than stack', async () => {
		game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf']})
		const wolf = game.enemies[0]
		new SavageBite(wolf, game.tank).executeNow()
		await settle()
		new SavageBite(wolf, game.tank).executeNow()
		await settle()

		expect(aurasNamed(game.tank, 'Rend')).toHaveLength(1)
		expect(auraEvents('Rend').map((event) => event.eventType)).toEqual(['SPELL_AURA_APPLIED', 'SPELL_AURA_REFRESH'])
	})

	/**
	 * A bite can be the killing blow, and `Encounter.onDeath` has already cancelled the auras a
	 * fresh wound would be joining. Planting one anyway leaves a Task mounted on a corpse.
	 */
	it('does not wound a target the same bite just killed', async () => {
		game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf']})
		const wolf = game.enemies[0]
		game.tank.health.set(1)
		new SavageBite(wolf, game.tank).executeNow()
		await settle()

		expect(game.tank.alive).toBe(false)
		expect(aurasNamed(game.tank, 'Rend')).toHaveLength(0)
	})
})
