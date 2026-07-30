import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import {settle} from '../test-setup'
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

const abilityEvents = (abilityId: string) => combatLogs.filter((event) => event.abilityId === abilityId)

/** The encounter logs its own start on a later microtask, and it is not something an ability did. */
const acted = () => combatLogs.filter((event) => event.eventType !== 'ENCOUNTER_START')

class Mark extends PeriodicAura {
	static id = 'Mark'
	static name = 'Mark'
	static harms = true
	static total = 4
	static interval = 1000
	static repeat = 2
}

/** Both kinds of outcome in one ability, which nothing in the game has yet and the base must allow. */
class Rebuke extends Ability {
	static id = 'Rebuke'
	static name = 'Rebuke'
	static targetRule = 'enemy' as const
	static effects = [new Damage(0.15), new ApplyAura(Mark, 0.1)]
}

let game!: GameLoop
beforeEach(() => clearLogs())
afterEach(() => game.disconnect())

describe('an ordered list of effects', () => {
	it('runs them in the order the ability declares', async () => {
		game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf']})
		const wolf = game.enemies[0]
		const before = wolf.health.current

		new Rebuke(game.tank, wolf).land()
		await settle()

		expect(wolf.health.current).toBeLessThan(before)
		expect([...wolf.auras].map((aura) => aura.id)).toEqual(['Mark'])
		// The hit is logged before the aura it precedes, because that is the order they ran in.
		expect(acted().map((event) => event.eventType)).toEqual(['SPELL_DAMAGE', 'SPELL_AURA_APPLIED'])
	})

	/**
	 * The reason the guard lives on the effect rather than on the ability: the target can die
	 * partway down the list, and death has already cancelled its auras by the time the next effect
	 * runs.
	 */
	it('plants no aura once an earlier effect killed the target', async () => {
		game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf']})
		const wolf = game.enemies[0]
		wolf.health.set(4)

		new Rebuke(game.tank, wolf).land()
		await settle()

		expect(wolf.alive).toBe(false)
		expect([...wolf.auras]).toHaveLength(0)
		expect(abilityEvents('Mark')).toHaveLength(0)
	})
})

describe('the effects themselves', () => {
	it('heals by the ability amount, within a few percent', async () => {
		game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf']})
		game.tank.health.set(10)

		class Mend extends Ability {
			static id = 'TestMend'
			static name = 'Test Mend'
			static targetRule = 'ally' as const
			static school = 'holy' as const
			static effects = [new Heal(1)]
		}
		new Mend(game.player, game.tank).land()

		const healed = game.tank.health.current - 10
		expect(healed).toBeGreaterThanOrEqual(95)
		expect(healed).toBeLessThanOrEqual(105)
		expect(abilityEvents('TestMend')[0]).toMatchObject({eventType: 'SPELL_HEAL'})
	})

	/**
	 * Savage Bite's bite and its bleed are two outcomes of one use, each with its own coefficient.
	 * The whole point of a coefficient living on the effect: nothing forces them to the same size.
	 */
	it("sizes each of a composite ability's outcomes on its own", async () => {
		game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf']})
		const wolf = game.enemies[0]
		const [bite, wound] = SavageBite.effects

		new SavageBite(wolf, game.tank).land()
		await settle()

		const [bleed] = [...game.tank.auras]
		expect(bleed).toBeInstanceOf(Rend)
		expect((bleed as Rend).total).toBe(wound.coefficient! * wolf.stats.attackPower)
		expect(wound.coefficient).not.toBe(bite.coefficient)
		expect((bleed as Rend).school).toBe('physical')
	})
})
