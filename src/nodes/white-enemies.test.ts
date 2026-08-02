import {describe, expect, it} from 'vitest'
import {analyze} from '../sim/report'
import {runFight, unitsOf} from '../sim/run'
import {TheWhite} from './dungeon'
import {Hollow} from './attack'
import {GameLoop} from './game-loop'

describe('Hollow', () => {
	it('drains the target mana pool instead of moving a health bar, and does nothing to a unit with none', async () => {
		const game = new GameLoop({party: ['Tank', 'Wren'], enemies: ['Glider']})
		const glider = game.enemies[0]
		const player = game.party.find((unit) => unit.unitId === 'Player')!
		const tank = game.party.find((unit) => unit.unitId === 'Tank')!
		const manaBefore = player.mana!.current
		const healthBefore = player.health.current

		new Hollow(glider, player).land()
		expect(player.mana!.current).toBeLessThan(manaBefore)
		expect(player.health.current).toBe(healthBefore)
		const firstBurn = manaBefore - player.mana!.current
		expect(game.combatLog.events.at(-1)).toMatchObject({
			eventType: 'RESOURCE_SPENT',
			sourceId: player.id,
			targetId: glider.id,
			abilityId: 'Hollow',
			value: -(manaBefore - player.mana!.current),
		})

		// A drain that reaches zero reports only what the pool held, not the requested amount.
		player.mana!.set(10)
		new Hollow(glider, player).land()
		expect(player.mana!.current).toBe(0)
		expect(game.combatLog.events.at(-1)?.value).toBe(-10)

		const report = analyze(game.combatLog.events, {units: unitsOf(game)})
		const playerStats = report.units.find((unit) => unit.id === player.id)!
		expect(playerStats).toMatchObject({
			manaSpent: 0,
			manaBurned: firstBurn + 10,
			manaGained: 0,
			manaNet: -(firstBurn + 10),
		})
		expect(report.abilities.find((ability) => ability.id === 'Hollow')).toMatchObject({manaSpent: firstBurn + 10})

		// Tank has no mana pool — landing on them must not throw and must change nothing.
		const tankHealthBefore = tank.health.current
		expect(() => new Hollow(glider, tank).land()).not.toThrow()
		expect(tank.health.current).toBe(tankHealthBefore)
		game.disconnect()
	})
})

describe('Uvalu', () => {
	it('threatens for real: idle loses to it, triage survives while spending real mana', async () => {
		const idle = await runFight({
			room: {party: ['Tank', 'Wren', 'Clover', 'Gale'], enemies: ['Uvalu']},
			bot: 'idle',
			seed: 1,
		})
		expect(idle.outcome).toBe('defeat')

		// Seed 3, not 1: Uvalu is meant to be genuinely hard (~8-in-10 triage win rate over 200
		// seeds with the full four-body party, Gale included, #90), so a fixed seed here only has
		// to be one of the wins, not every seed.
		const triage = await runFight({
			room: {party: ['Tank', 'Wren', 'Clover', 'Gale'], enemies: ['Uvalu']},
			bot: 'triage',
			seed: 3,
		})
		expect(triage.outcome).toBe('victory')
		const player = analyze(triage.events, triage).units.find((unit) => unit.name === 'Player')!
		expect(player.manaBurned).toBeGreaterThan(0)
		expect(player.manaGained).toBeGreaterThan(0)
		expect(player.endMana).toBe(player.maxMana! + player.manaNet)
		expect(triage.events.some((event) => event.eventType === 'RESOURCE_SPENT' && event.abilityId === 'Hollow')).toBe(
			true,
		)
	})
})

describe('White mana choices', () => {
	it('makes efficient healing beat fast-heal panic over many seeds', async () => {
		const room = TheWhite.rooms[1]
		const seeds = Array.from({length: 20}, (_, index) => index + 1)
		const play = async (bot: 'triage' | 'panic') => {
			const reports = []
			for (const seed of seeds) {
				const fight = await runFight({room, bot, seed})
				const report = analyze(fight.events, fight)
				reports.push({outcome: fight.outcome, player: report.units.find((unit) => unit.name === 'Player')!})
			}
			return reports
		}
		const [triage, panic] = await Promise.all([play('triage'), play('panic')])
		const average = (
			reports: Awaited<ReturnType<typeof play>>,
			pick: (player: (typeof reports)[number]['player']) => number,
		) => reports.reduce((total, report) => total + pick(report.player), 0) / reports.length

		expect(triage.filter((report) => report.outcome === 'victory').length).toBeGreaterThan(
			panic.filter((report) => report.outcome === 'victory').length,
		)
		expect(average(panic, (player) => player.manaSpent)).toBeGreaterThan(average(triage, (player) => player.manaSpent))
	})
})
