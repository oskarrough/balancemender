import {describe, expect, it} from 'vitest'
import type {CombatLogEvent} from '../combatlog'
import {formatBenchmark, summarizeBenchmark} from './benchmark'
import type {FightResult} from './run'

const units: FightResult['units'] = [
	{id: 'tank', name: 'Oak', maxHealth: 300, faction: 'party', unitId: 'Tank'},
	{id: 'player', name: 'Player', maxHealth: 160, faction: 'party', unitId: 'Player', maxMana: 600, endMana: 100},
	{id: 'wolf', name: 'Runt', maxHealth: 240, faction: 'enemy', unitId: 'Runt'},
]

const event = (partial: Partial<CombatLogEvent>): CombatLogEvent => ({
	timestamp: 0,
	time: 0,
	eventType: 'FIGHT_START',
	...partial,
})

function result(playerFalls: boolean): FightResult {
	const events = [
		event({eventType: 'FIGHT_START'}),
		event({
			time: 200,
			eventType: 'SWING_DAMAGE',
			sourceId: 'wolf',
			sourceName: 'Runt',
			targetId: 'player',
			targetName: 'Player',
			value: playerFalls ? 30 : 10,
		}),
		event({
			time: 300,
			eventType: 'SWING_DAMAGE',
			sourceId: 'wolf',
			sourceName: 'Runt',
			targetId: 'tank',
			targetName: 'Oak',
			value: playerFalls ? 70 : 20,
		}),
		...(playerFalls
			? [
					event({
						time: 900,
						eventType: 'SPELL_CAST_START',
						sourceId: 'player',
						sourceName: 'Player',
						abilityId: 'Mend',
						abilityName: 'Mend',
						busyFor: 1500,
					}),
					event({time: 950, eventType: 'UNIT_DIED', targetId: 'player', targetName: 'Player'}),
				]
			: []),
		event({time: 1000, eventType: 'FIGHT_END'}),
	]

	return {
		trial: {bot: 'triage'},
		seed: playerFalls ? 1 : 2,
		outcome: 'victory',
		duration: 1000,
		events,
		units,
		survivors: {party: playerFalls ? 1 : 2, enemies: 0},
	}
}

describe('a room benchmark', () => {
	it('separates wins from clean wins and shows who absorbed the pressure', () => {
		const row = summarizeBenchmark([result(true), result(false)], 'baseline', 'triage')

		expect(row).toMatchObject({
			winPercent: 100,
			cleanWinPercent: 50,
			playerSurvivalPercent: 50,
			partySurvivalPercent: 50,
			victoryAfterPlayerFallPercent: 50,
			busyPercent: 3,
		})
		expect(row.pressure).toEqual([
			{
				unit: 'Oak',
				survivalPercent: 100,
				hitSharePercent: 50,
				damageSharePercent: 69,
				averageDamageTaken: 45,
				hurtPercent: 0,
			},
			{
				unit: 'Player',
				survivalPercent: 50,
				hitSharePercent: 50,
				damageSharePercent: 31,
				averageDamageTaken: 20,
				hurtPercent: 0,
			},
		])
	})

	it('formats both outcome and pressure tables', () => {
		const row = summarizeBenchmark([result(true), result(false)], 'baseline', 'triage')
		const text = formatBenchmark('The Green · Room 4: The howling', 2, [row])

		expect(text).toContain('win%')
		expect(text).toContain('after fall%')
		expect(text).toContain('pressure')
		expect(text).toContain('Player')
	})
})
