import {describe, it, expect, beforeEach} from 'vitest'
import {GameLoop} from './game-loop'
import {Ability} from './ability'
import {ApplyAura, Damage, Heal} from './effects'
import {PeriodicAura} from './periodic-aura'
import {SavageBite, Rend} from './attack'
import {combatLogs, clearLogs} from '../combatlog'

/**
 * An effect is the smallest thing an ability does. What is worth asserting here is that a list of
 * them behaves like a list — in order, and with each one seeing what the one before it did.
 */

const flush = () => Promise.resolve()

const abilityEvents = (abilityId: string) => combatLogs.filter((event) => event.abilityId === abilityId)

/** The encounter logs its own start on a later microtask, and it is not something an ability did. */
const acted = () => combatLogs.filter((event) => event.eventType !== 'ENCOUNTER_START')

class Mark extends PeriodicAura {
	static id = 'Mark'
	static name = 'Mark'
	static total = -4
	static interval = 1000
	static repeat = 2
}

/** Both kinds of outcome in one ability, which nothing in the game has yet and the base must allow. */
class Rebuke extends Ability {
	static id = 'Rebuke'
	static name = 'Rebuke'
	static targetRule = 'enemy' as const
	static minDamage = 6
	static maxDamage = 6
	static effects = [new Damage(), new ApplyAura(Mark)]
}

describe('an ordered list of effects', () => {
	beforeEach(() => clearLogs())

	it('runs them in the order the ability declares', async () => {
		const game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf']})
		const wolf = game.enemies[0]
		game.tank.currentTarget = wolf
		const before = wolf.health.current

		new Rebuke(game.tank).land()
		await flush()

		expect(wolf.health.current).toBe(before - 6)
		expect([...wolf.auras].map((aura) => aura.id)).toEqual(['Mark'])
		// The hit is logged before the aura it precedes, because that is the order they ran in.
		expect(acted().map((event) => event.eventType)).toEqual(['SPELL_DAMAGE', 'SPELL_AURA_APPLIED'])
		game.disconnect()
	})

	/**
	 * The reason the guard lives on the effect rather than on the ability: the target can die
	 * partway down the list, and death has already cancelled its auras by the time the next effect
	 * runs.
	 */
	it('plants no aura once an earlier effect killed the target', async () => {
		const game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf']})
		const wolf = game.enemies[0]
		wolf.health.set(4)
		game.tank.currentTarget = wolf

		new Rebuke(game.tank).land()
		await flush()

		expect(wolf.alive).toBe(false)
		expect([...wolf.auras]).toHaveLength(0)
		expect(abilityEvents('Mark')).toHaveLength(0)
		game.disconnect()
	})

	it('does nothing at all without a target', async () => {
		const game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf']})
		game.tank.currentTarget = undefined

		new Rebuke(game.tank).land()
		await flush()

		expect(acted()).toHaveLength(0)
		game.disconnect()
	})
})

describe('the effects themselves', () => {
	beforeEach(() => clearLogs())

	it('heals by the ability amount, within a few percent', async () => {
		const game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf']})
		game.tank.health.set(10)
		game.player.currentTarget = game.tank

		class Mend extends Ability {
			static id = 'TestMend'
			static name = 'Test Mend'
			static targetRule = 'ally' as const
			static magnitude = 100
			static effects = [new Heal()]
		}
		new Mend(game.player).land()

		const healed = game.tank.health.current - 10
		expect(healed).toBeGreaterThanOrEqual(95)
		expect(healed).toBeLessThanOrEqual(105)
		expect(abilityEvents('TestMend')[0]).toMatchObject({eventType: 'SPELL_HEAL'})
		game.disconnect()
	})

	/**
	 * Rend's magnitude sits on the aura and Renew's on the spell. An apply-aura effect hands over
	 * the ability's `heal` when it has one, which is the whole of that arrangement.
	 */
	it('leaves an aura its own numbers when the ability owns none', async () => {
		const game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf']})
		const wolf = game.enemies[0]
		wolf.currentTarget = game.tank

		new SavageBite(wolf).land()
		await flush()

		const [bleed] = [...game.tank.auras]
		expect(bleed).toBeInstanceOf(Rend)
		expect((bleed as Rend).total).toBe(Rend.total)
		game.disconnect()
	})
})
