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
		const report = analyze(fight.events, {roster: fight.roster})
		const tank = report.actors.find((a) => a.name === 'Tank')!
		const player = report.actors.find((a) => a.name === 'Player')!
		const renew = report.spells.find((s) => s.name === 'Renew')!

		// The test only means something if Renew actually landed on the Tank.
		expect(renew.hits).toBeGreaterThan(0)
		expect(tank.healingTaken).toBeGreaterThan(0)

		expect(tank.healingDone).toBe(0)
		expect(tank.casts).toBe(0)
		expect(player.healingDone).toBeGreaterThan(0)
	})

	it('counts a cast of Renew once, not once per tick', () => {
		const report = analyze(fight.events, {roster: fight.roster})
		const renew = report.spells.find((s) => s.name === 'Renew')!
		const cast = fight.events.filter((e) => e.eventType === 'SPELL_CAST_SUCCESS' && e.spellName === 'Renew')

		expect(cast.length).toBeGreaterThan(0)
		expect(renew.casts).toBe(cast.length)
		expect(renew.hits).toBeGreaterThan(renew.casts)

		// Every cast in the spell table is a cast someone made.
		const player = report.actors.find((a) => a.name === 'Player')!
		expect(player.casts).toBe(report.spells.reduce((total, spell) => total + spell.casts, 0))
	})
})
