// @vitest-environment happy-dom
import {describe, it, expect, beforeAll} from 'vitest'
import {runFight, type FightResult} from './run'
import {analyze} from './report'

/**
 * A HoT ticks long after the cast, on a unit that is not the caster. These pin down who the
 * report credits for those ticks, and that a tick is never mistaken for a cast of its own.
 */
describe('a fight full of Renew', () => {
	let fight: FightResult

	beforeAll(async () => {
		fight = await runFight({enemies: ['TinyWolf', 'TinyWolf'], policy: 'renew', seed: 1})
	})

	it('credits Renew ticks to the caster, not the unit being healed', () => {
		const report = analyze(fight.events, {units: fight.units})
		const tank = report.actors.find((a) => a.name === 'Tank')!
		const player = report.actors.find((a) => a.name === 'Player')!
		const renew = report.abilities.find((a) => a.name === 'Renew')!

		// The test only means something if Renew actually landed on the Tank.
		expect(renew.hits).toBeGreaterThan(0)
		expect(tank.healingTaken).toBeGreaterThan(0)

		expect(tank.healingDone).toBe(0)
		expect(tank.casts).toBe(0)
		expect(player.healingDone).toBeGreaterThan(0)
	})

	it('counts a cast of Renew once, not once per tick', () => {
		const report = analyze(fight.events, {units: fight.units})
		const renew = report.abilities.find((a) => a.name === 'Renew')!
		const cast = fight.events.filter((e) => e.eventType === 'SPELL_CAST_SUCCESS' && e.abilityName === 'Renew')

		expect(cast.length).toBeGreaterThan(0)
		expect(renew.casts).toBe(cast.length)
		expect(renew.hits).toBeGreaterThan(renew.casts)

		// Every cast in the ability table is a cast someone made.
		const player = report.actors.find((a) => a.name === 'Player')!
		expect(player.casts).toBe(report.abilities.reduce((total, ability) => total + ability.casts, 0))
	})
})
