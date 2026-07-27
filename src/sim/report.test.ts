import {describe, it, expect} from 'vitest'
import {analyze, healthSeries, partyInjuredTime} from './report'
import {sparkline} from './format'
import type {CombatLogEvent} from '../combatlog'
import type {UnitInfo} from './run'

const units: UnitInfo[] = [
	{id: 'tank', name: 'Tank', maxHealth: 100, faction: 'party'},
	{id: 'wolf', name: 'Wolf', maxHealth: 50, faction: 'enemy'},
]

const event = (partial: Partial<CombatLogEvent>): CombatLogEvent => ({
	timestamp: 0,
	time: 0,
	eventType: 'SPELL_DAMAGE',
	...partial,
})

// Every event the game logs carries both an id and a name for whoever it touches, so these do too.
const fight: CombatLogEvent[] = [
	event({time: 0, eventType: 'ENCOUNTER_START'}),
	event({
		time: 1000,
		eventType: 'SWING_DAMAGE',
		sourceId: 'wolf',
		sourceName: 'Wolf',
		targetId: 'tank',
		targetName: 'Tank',
		value: 30,
	}),
	event({
		time: 500,
		eventType: 'SPELL_CAST_START',
		sourceId: 'player',
		sourceName: 'Player',
		abilityId: 'Heal',
		abilityName: 'Heal',
		value: 1500,
		// The cast time or the global cooldown, whichever is longer — see `logCombat`.
		busyFor: 1500,
	}),
	event({
		time: 2000,
		eventType: 'SPELL_CAST_SUCCESS',
		sourceId: 'player',
		sourceName: 'Player',
		abilityId: 'Heal',
		abilityName: 'Heal',
	}),
	event({
		time: 2000,
		eventType: 'SPELL_HEAL',
		sourceId: 'player',
		sourceName: 'Player',
		targetId: 'tank',
		targetName: 'Tank',
		abilityId: 'Heal',
		abilityName: 'Heal',
		value: 40,
		overheal: 10,
	}),
	event({
		time: 3000,
		eventType: 'SWING_DAMAGE',
		sourceId: 'tank',
		sourceName: 'Tank',
		targetId: 'wolf',
		targetName: 'Wolf',
		abilityId: 'ShieldBash',
		abilityName: 'Shield Bash',
		value: 50,
	}),
	event({time: 3000, eventType: 'UNIT_DIED', targetId: 'wolf', targetName: 'Wolf'}),
]

describe('analyze', () => {
	const report = analyze(fight, {units, outcome: 'victory'})

	it('splits healing into effective and overhealing', () => {
		const player = report.units.find((a) => a.name === 'Player')!
		expect(player.healingDone).toBe(30)
		expect(player.overhealing).toBe(10)
		expect(player.casts).toBe(1)
	})

	/**
	 * Against the duration this is the answer to "was the healer out of time or out of mana",
	 * which a cast count cannot give — and it was the question behind #50.
	 */
	it('adds up how long a unit was committed to casting', () => {
		const player = report.units.find((a) => a.name === 'Player')!
		expect(player.busyTime).toBe(1500)
		expect(report.units.find((a) => a.name === 'Tank')!.busyTime).toBe(0)
	})

	it('tracks damage from both sides', () => {
		const tank = report.units.find((a) => a.name === 'Tank')!
		expect(tank.damageDone).toBe(50)
		expect(tank.damageTaken).toBe(30)
	})

	it('reports totals per second over the fight', () => {
		expect(report.duration).toBe(3000)
		expect(report.totals.damage).toBe(80)
		expect(report.totals.dps).toBe(26.7)
		expect(report.totals.hps).toBe(10)
	})

	it('records deaths with the time they happened', () => {
		expect(report.deaths).toEqual([{id: 'wolf', name: 'Wolf', time: 3000}])
		expect(report.units.find((a) => a.name === 'Wolf')!.deathTime).toBe(3000)
	})

	// Spawning a second wolf renames the first one to "Tiny wolf 1" halfway through the log.
	// Keyed by name, that split one unit into two rows and merged the new one into the old.
	it('follows a unit that gets renamed mid-fight', () => {
		const renamed = analyze(
			[
				event({time: 0, eventType: 'SWING_DAMAGE', sourceId: 'w1', sourceName: 'Tiny wolf', value: 10}),
				event({time: 1000, eventType: 'SWING_DAMAGE', sourceId: 'w2', sourceName: 'Tiny wolf 2', value: 5}),
				event({time: 2000, eventType: 'SWING_DAMAGE', sourceId: 'w1', sourceName: 'Tiny wolf 1', value: 10}),
			],
			{
				units: [
					{id: 'w1', name: 'Tiny wolf 1', maxHealth: 50, faction: 'enemy'},
					{id: 'w2', name: 'Tiny wolf 2', maxHealth: 50, faction: 'enemy'},
				],
			},
		)
		expect(renamed.units.map((a) => [a.name, a.damageDone])).toEqual([
			['Tiny wolf 1', 20],
			['Tiny wolf 2', 5],
		])
	})

	it('groups by ability', () => {
		const heal = report.abilities.find((a) => a.name === 'Heal')!
		expect(heal).toMatchObject({casts: 1, hits: 1, total: 40, overheal: 10, avg: 40})
	})

	it('survives an empty log', () => {
		const empty = analyze([])
		expect(empty.duration).toBe(0)
		expect(empty.units).toEqual([])
	})
})

/**
 * A shield changes no health bar, so `SPELL_ABSORBED` and the `wasted` carried on
 * `SPELL_AURA_REMOVED`/`REFRESH` are the only trace it leaves in the log — see #47.
 */
describe('absorption', () => {
	it('credits absorbed damage to the shield caster, not the shielded ally', () => {
		const report = analyze(
			[
				event({
					time: 1000,
					eventType: 'SPELL_ABSORBED',
					sourceId: 'player',
					sourceName: 'Player',
					targetId: 'tank',
					targetName: 'Tank',
					abilityId: 'PowerWordShield',
					abilityName: 'Power Word: Shield',
					value: 25,
				}),
			],
			{units},
		)

		const player = report.units.find((a) => a.name === 'Player')!
		expect(player.absorbed).toBe(25)
		expect(report.units.find((a) => a.name === 'Tank')!.absorbed).toBe(0)
	})

	it('totals unspent pool from SPELL_AURA_REMOVED as waste, the way overheal works for a heal', () => {
		const report = analyze(
			[
				event({
					time: 1000,
					eventType: 'SPELL_AURA_REMOVED',
					sourceId: 'player',
					sourceName: 'Player',
					targetId: 'tank',
					targetName: 'Tank',
					abilityId: 'PowerWordShield',
					abilityName: 'Power Word: Shield',
					wasted: 40,
				}),
			],
			{units},
		)

		expect(report.units.find((a) => a.name === 'Player')!.wasted).toBe(40)
	})

	it('also counts waste carried onto a SPELL_AURA_REFRESH, when a recast replaces an unspent shield', () => {
		const report = analyze(
			[
				event({
					time: 1000,
					eventType: 'SPELL_AURA_REFRESH',
					sourceId: 'player',
					sourceName: 'Player',
					targetId: 'tank',
					targetName: 'Tank',
					abilityId: 'PowerWordShield',
					abilityName: 'Power Word: Shield',
					wasted: 15,
				}),
			],
			{units},
		)

		expect(report.units.find((a) => a.name === 'Player')!.wasted).toBe(15)
	})

	it('leaves a periodic aura ending with no `wasted` alone', () => {
		const report = analyze(
			[
				event({
					time: 500,
					eventType: 'SPELL_CAST_SUCCESS',
					sourceId: 'player',
					sourceName: 'Player',
					abilityId: 'Renew',
					abilityName: 'Renew',
				}),
				event({
					time: 1000,
					eventType: 'SPELL_AURA_REMOVED',
					sourceId: 'player',
					sourceName: 'Player',
					targetId: 'tank',
					targetName: 'Tank',
					abilityId: 'Renew',
					abilityName: 'Renew',
				}),
			],
			{units},
		)

		expect(report.units.find((a) => a.name === 'Player')!.wasted).toBe(0)
	})
})

/**
 * Time spent below the injured line is what separates a fight the healer won from one that was
 * never in doubt — the question behind #50 and #51. It is counted from `UNIT_CONDITION` rather
 * than replayed off the health bar, because what counts as injured is a number `--tune` moves.
 */
describe('injuredTime', () => {
	const hurt = (partial: Partial<CombatLogEvent>) =>
		event({eventType: 'UNIT_CONDITION', targetId: 'tank', targetName: 'Tank', ...partial})

	it('adds up the stretches a unit spent injured', () => {
		const report = analyze(
			[
				event({time: 0, eventType: 'ENCOUNTER_START'}),
				hurt({time: 1000, condition: 'injured'}),
				hurt({time: 3000, condition: 'steady'}),
				hurt({time: 5000, condition: 'injured'}),
				hurt({time: 6000, condition: 'healthy'}),
				event({time: 8000, eventType: 'ENCOUNTER_END'}),
			],
			{units},
		)

		expect(report.units.find((a) => a.name === 'Tank')!.injuredTime).toBe(3000)
		expect(partyInjuredTime(report)).toBe(3000)
	})

	it('closes a stretch still open when the fight ends', () => {
		const report = analyze([event({time: 0, eventType: 'ENCOUNTER_START'}), hurt({time: 2000, condition: 'injured'})], {
			units,
			duration: 10_000,
		})

		expect(report.units.find((a) => a.name === 'Tank')!.injuredTime).toBe(8000)
	})

	/** A killing blow logs no condition change, so without this the interval would run to the end. */
	it('stops the clock at death rather than at the end of the fight', () => {
		const report = analyze(
			[
				event({time: 0, eventType: 'ENCOUNTER_START'}),
				hurt({time: 1000, condition: 'injured'}),
				event({time: 4000, eventType: 'UNIT_DIED', targetId: 'tank', targetName: 'Tank'}),
				event({time: 9000, eventType: 'ENCOUNTER_END'}),
			],
			{units},
		)

		expect(report.units.find((a) => a.name === 'Tank')!.injuredTime).toBe(3000)
	})

	it('counts nobody as hurt in a fight where nobody crossed the line', () => {
		expect(partyInjuredTime(analyze(fight, {units}))).toBe(0)
	})
})

describe('health series', () => {
	it('rebuilds health over time from the log alone', () => {
		const [tank, wolf] = healthSeries(fight, units, 0, 3000, 3)
		expect(tank.endHealth).toBe(100) // 100 - 30 + 30 effective
		expect(tank.points).toEqual([1, 0.7, 1])
		expect(wolf.endHealth).toBe(0)
		expect(wolf.points[2]).toBe(0)
	})

	it('draws dead units as a flat line', () => {
		expect(sparkline([1, 0.5, 0])).toBe('█▄·')
	})
})
