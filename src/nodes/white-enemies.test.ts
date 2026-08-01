import {describe, expect, it} from 'vitest'
import {runFight} from '../sim/run'
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

		// Tank has no mana pool — landing on them must not throw and must change nothing.
		const tankHealthBefore = tank.health.current
		expect(() => new Hollow(glider, tank).land()).not.toThrow()
		expect(tank.health.current).toBe(tankHealthBefore)
	})
})

describe('Uvalu', () => {
	it('threatens for real: idle loses to it, triage survives while spending real mana', async () => {
		const idle = await runFight({
			room: {party: ['Tank', 'Wren', 'Clover'], enemies: ['Uvalu']},
			bot: 'idle',
			seed: 1,
		})
		expect(idle.outcome).toBe('defeat')

		// Seed 3, not 1: Uvalu is meant to be genuinely hard (~83% triage win rate over 200 seeds
		// with the full party, Clover included, #88), so a fixed seed here only has to be one of the
		// wins, not every seed.
		const triage = await runFight({
			room: {party: ['Tank', 'Wren', 'Clover'], enemies: ['Uvalu']},
			bot: 'triage',
			seed: 3,
		})
		expect(triage.outcome).toBe('victory')
		expect(triage.events.some((event) => event.eventType === 'RESOURCE_SPENT' && event.abilityId === 'Hollow')).toBe(
			true,
		)
	})
})
