import {describe, it, expect} from 'vitest'
import {analyze, healthSeries} from './report'
import {sparkline} from './format'
import type {CombatLogEvent} from '../combatlog'
import type {RosterEntry} from './run'

const roster: RosterEntry[] = [
	{id: 'tank', name: 'Tank', maxHealth: 100, faction: 'party'},
	{id: 'wolf', name: 'Wolf', maxHealth: 50, faction: 'enemy'},
]

const event = (partial: Partial<CombatLogEvent>): CombatLogEvent => ({
	timestamp: 0,
	time: 0,
	eventType: 'SPELL_DAMAGE',
	...partial,
})

const fight: CombatLogEvent[] = [
	event({time: 0, eventType: 'ENCOUNTER_START'}),
	event({time: 1000, eventType: 'SWING_DAMAGE', sourceName: 'Wolf', targetName: 'Tank', targetId: 'tank', value: 30}),
	event({
		time: 2000,
		eventType: 'SPELL_CAST_SUCCESS',
		sourceName: 'Player',
		spellName: 'Heal',
	}),
	event({
		time: 2000,
		eventType: 'SPELL_HEAL',
		sourceName: 'Player',
		targetName: 'Tank',
		targetId: 'tank',
		spellName: 'Heal',
		value: 40,
		overheal: 10,
	}),
	event({
		time: 3000,
		eventType: 'SWING_DAMAGE',
		sourceName: 'Tank',
		targetName: 'Wolf',
		targetId: 'wolf',
		spellName: 'Shield Bash',
		value: 50,
	}),
	event({time: 3000, eventType: 'UNIT_DIED', targetName: 'Wolf', targetId: 'wolf'}),
]

describe('analyze', () => {
	const report = analyze(fight, {roster, outcome: 'victory'})

	it('splits healing into effective and overhealing', () => {
		const player = report.actors.find((a) => a.name === 'Player')!
		expect(player.healingDone).toBe(30)
		expect(player.overhealing).toBe(10)
		expect(player.casts).toBe(1)
	})

	it('tracks damage from both sides', () => {
		const tank = report.actors.find((a) => a.name === 'Tank')!
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
		expect(report.deaths).toEqual([{name: 'Wolf', time: 3000}])
		expect(report.actors.find((a) => a.name === 'Wolf')!.deathTime).toBe(3000)
	})

	it('groups by spell', () => {
		const heal = report.spells.find((s) => s.name === 'Heal')!
		expect(heal).toMatchObject({casts: 1, hits: 1, total: 40, overheal: 10, avg: 40})
	})

	it('survives an empty log', () => {
		const empty = analyze([])
		expect(empty.duration).toBe(0)
		expect(empty.actors).toEqual([])
	})
})

describe('health series', () => {
	it('rebuilds health over time from the log alone', () => {
		const [tank, wolf] = healthSeries(fight, roster, 0, 3000, 3)
		expect(tank.endHealth).toBe(100) // 100 - 30 + 30 effective
		expect(tank.points).toEqual([1, 0.7, 1])
		expect(wolf.endHealth).toBe(0)
		expect(wolf.points[2]).toBe(0)
	})

	it('draws dead units as a flat line', () => {
		expect(sparkline([1, 0.5, 0])).toBe('█▄·')
	})
})
