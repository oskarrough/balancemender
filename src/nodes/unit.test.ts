import {describe, it, expect, beforeEach} from 'vitest'
import {GameLoop} from './game-loop'
import {CONDITION_THRESHOLDS} from './unit'
import {applyHit} from './hit'
import {combatLogs, clearLogs} from '../combatlog'
import {resetBalance, setRuleValue} from '../balance'

/**
 * `condition` is a primitive nothing casts off yet, so these tests are the whole specification
 * of it. What they pin down is the boundary: "injured below 35%" and "healthy above 80%" are
 * exclusive, so a unit sitting exactly on a line is in neither band.
 */
describe('Unit.condition', () => {
	const tank = () => {
		const game = new GameLoop({party: ['Tank'], enemies: []})
		return {game, unit: game.tank}
	}
	const at = (max: number, percent: number) => (max * percent) / 100

	it('reads the three bands off the health bar', () => {
		const {game, unit} = tank()
		const {max} = unit.health

		expect(unit.condition).toBe('healthy')
		expect(unit.healthy).toBe(true)

		unit.health.set(at(max, 50))
		expect(unit.condition).toBe('steady')
		expect(unit.healthy).toBe(false)
		expect(unit.injured).toBe(false)

		unit.health.set(at(max, 20))
		expect(unit.condition).toBe('injured')
		expect(unit.injured).toBe(true)

		game.disconnect()
	})

	/**
	 * The one that breaks quietly. Cross-multiplying `current * 100` against the threshold puts
	 * a unit sitting exactly on a line on the wrong side of it for 305 of the first 2000 max
	 * health values — a mechanic that fires one point early on some units and not others.
	 */
	it('leaves a unit sitting exactly on a threshold in neither band', () => {
		const {game, unit} = tank()
		const {max} = unit.health

		unit.health.set(at(max, CONDITION_THRESHOLDS.injured))
		expect(unit.condition).toBe('steady')

		unit.health.set(at(max, CONDITION_THRESHOLDS.healthy))
		expect(unit.condition).toBe('steady')

		game.disconnect()
	})

	/** Orthogonal to `alive` on purpose — see the comment on `injured`. */
	it('calls a corpse injured, and leaves saying it is dead to `alive`', () => {
		const {game, unit} = tank()
		unit.health.set(0)

		expect(unit.condition).toBe('injured')
		expect(unit.alive).toBe(false)

		game.disconnect()
	})
})

describe('the condition thresholds are balance numbers', () => {
	beforeEach(() => resetBalance())

	/**
	 * The reason a rule is its own balance kind: the other five are class statics copied onto an
	 * instance when it is built, so a retune waits for the next cast. A threshold is read where it
	 * is used, so moving it re-reads every unit already fighting.
	 */
	it('moves the bands on the fight already in progress', () => {
		const game = new GameLoop({party: ['Tank'], enemies: []})
		game.tank.health.set(game.tank.health.max * 0.5)

		expect(game.tank.condition).toBe('steady')

		setRuleValue('Condition', 'injured', 60)
		expect(game.tank.condition).toBe('injured')

		resetBalance()
		expect(game.tank.condition).toBe('steady')
		game.disconnect()
	})
})

/**
 * Crossing a threshold is logged for the same reason a death is: the analyzer cannot work it out
 * for itself. It could replay the health bar — but not what counts as injured, which `--tune`
 * moves, and a report holding the old number would be confidently wrong.
 */
describe('UNIT_CONDITION', () => {
	beforeEach(() => clearLogs())

	const conditions = () => combatLogs.filter((event) => event.eventType === 'UNIT_CONDITION')

	it('records a crossing once, after the hit that caused it, with who caused it', () => {
		const game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf']})
		const wolf = game.enemies[0]
		const hit = (amount: number) =>
			applyHit({
				source: wolf,
				target: game.tank,
				amount,
				abilityId: 'SavageBite',
				abilityName: 'Bite',
				eventType: 'SWING_DAMAGE',
			})

		hit(-game.tank.health.max * 0.5)
		expect(conditions()).toHaveLength(1)
		expect(conditions()[0]).toMatchObject({condition: 'steady', targetId: game.tank.id, sourceId: wolf.id})
		// After its own cause, so the log reads as damage-then-consequence rather than the reverse.
		expect(combatLogs.at(-2)?.eventType).toBe('SWING_DAMAGE')

		// Still steady: no second event for staying put.
		hit(-game.tank.health.max * 0.1)
		expect(conditions()).toHaveLength(1)

		hit(-game.tank.health.max * 0.2)
		expect(conditions()).toHaveLength(2)
		expect(conditions()[1]).toMatchObject({condition: 'injured'})
		game.disconnect()
	})

	it('says nothing extra when the hit kills, because a corpse reading injured is not news', () => {
		const game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf']})
		applyHit({
			source: game.enemies[0],
			target: game.tank,
			amount: -game.tank.health.max,
			abilityId: 'SavageBite',
			abilityName: 'Bite',
			eventType: 'SWING_DAMAGE',
		})

		expect(conditions()).toHaveLength(0)
		expect(combatLogs.at(-1)?.eventType).toBe('UNIT_DIED')
		game.disconnect()
	})
})

describe('Resource.ratio', () => {
	it('is zero rather than NaN when there is no pool at all', () => {
		const game = new GameLoop({party: ['Tank'], enemies: []})
		game.tank.health.max = 0

		expect(game.tank.health.ratio).toBe(0)
		expect(game.tank.condition).toBe('injured')

		game.disconnect()
	})
})
