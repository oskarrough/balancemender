import {describe, it, expect, afterEach} from 'vitest'
import {settle} from '../test-setup'
import {SimLoop} from '../sim/run'
import {BarrierAura} from './barrier-aura'
import {GameLoop} from './game-loop'
import {Shield} from './spells'
import {applyHit} from './hit'
import type {Unit} from './unit'
import type {Room} from './fight'
import {planted} from './effects'

/**
 * A barrier is the one thing in the game that works by *not* moving a health bar, so most of what
 * is asserted here is something that did not happen — and the log entry that is the only reason
 * anyone could tell it happened at all.
 */

const ROOM: Room = {id: 'barrier-test', party: ['Tank'], enemies: ['Runt']}

let game!: GameLoop
const events = (eventType: string) => game.combatLog.events.filter((event) => event.eventType === eventType)

afterEach(() => game.disconnect())

/**
 * A tank, a wolf and everything mounted — where every case here starts. Reach for `game`
 * afterwards rather than a return value: a vroum Loop is thenable, so `await`ing one never
 * resolves.
 */
const start = async (loop: GameLoop = new GameLoop(ROOM)) => {
	game = loop
	await settle()
}

const bite = (target: Unit, damage: number) =>
	applyHit({
		source: game.enemies[0],
		target,
		amount: -damage,
		abilityId: 'SavageBite',
		abilityName: 'Savage Bite',
		eventType: 'SWING_DAMAGE',
		school: 'physical',
	})

describe('absorbing', () => {
	it('takes its share off a hit before the health bar moves', async () => {
		await start()
		new BarrierAura(game.party[0], game.player, planted(20))
		await settle()

		const full = game.party[0].health.current
		bite(game.party[0], 50)

		expect(game.party[0].health.current).toBe(full - 30)
	})

	it('leaves the bar alone when it covers the whole hit, and says so in the log', async () => {
		await start()
		new Shield(game.player, game.party[0]).land()
		await settle()

		const full = game.party[0].health.current
		bite(game.party[0], 30)

		expect(game.party[0].health.current).toBe(full)
		expect(events('SPELL_ABSORBED')).toHaveLength(1)
		expect(events('SPELL_ABSORBED')[0]).toMatchObject({
			// The barrier's caster, never whoever swung: prevention is credited the way healing is.
			sourceId: game.player.id,
			targetId: game.party[0].id,
			abilityId: 'Shield',
			value: 30,
		})
	})

	it('spends the pool, lets the remainder land, and is gone', async () => {
		await start()
		new BarrierAura(game.party[0], game.player, planted(20))
		await settle()

		bite(game.party[0], 50)

		expect(events('SPELL_ABSORBED')[0].value).toBe(20)
		// The damage event reports what got through, not what was swung — same number the health
		// bar moved by.
		expect(events('SWING_DAMAGE')[0].value).toBe(30)
		expect([...game.party[0].auras]).toHaveLength(0)
	})

	it('walks barriers oldest first', async () => {
		await start()
		// Two casters, or the second would supersede the first rather than join it — see `stackKey`.
		const first = new BarrierAura(game.party[0], game.player, planted(10))
		const second = new BarrierAura(game.party[0], game.party[0], planted(10))
		await settle()

		bite(game.party[0], 15)

		expect(first.pool).toBe(0)
		expect(second.pool).toBe(5)
	})

	it('reports the pool nobody spent when it falls off', async () => {
		await start()
		const barrier = new BarrierAura(game.party[0], game.player, planted(100))
		await settle()

		bite(game.party[0], 30)
		barrier.disconnect()
		await settle()

		expect(events('SPELL_AURA_REMOVED')[0]).toMatchObject({abilityId: 'Barrier', wasted: 70})
	})

	/**
	 * A barrier recast early wastes what was left just as surely as one that timed out — but the
	 * copy it replaces is superseded, and superseding logs no removal. The refresh carries it, or
	 * nothing does and reapplying a barrier looks free.
	 */
	it('reports the pool nobody spent when a recast replaces it', async () => {
		await start()
		new BarrierAura(game.party[0], game.player, planted(100))
		await settle()

		bite(game.party[0], 30)
		new BarrierAura(game.party[0], game.player, planted(100))
		await settle()

		expect(events('SPELL_AURA_REMOVED')).toHaveLength(0)
		expect(events('SPELL_AURA_REFRESH')[0]).toMatchObject({abilityId: 'Barrier', wasted: 70})
	})

	it('does not supersede a Shield from the same caster', async () => {
		await start()
		new Shield(game.player, game.party[0]).land()
		await settle()
		const [shield] = [...game.party[0].auras]

		new BarrierAura(game.party[0], game.player, planted(10))
		await settle()

		expect([...game.party[0].auras].map((aura) => aura.id)).toEqual(['Shield', 'Barrier'])
		expect(shield.superseded).toBe(false)
	})
})

/**
 * Absorb, then damage, then decide who died — in that order. Getting it wrong kills a unit the
 * barrier was holding up, and no assertion on health alone would notice.
 */
describe('a killing blow through a barrier', () => {
	it('does not kill what the barrier covered', async () => {
		await start()
		game.party[0].health.set(40)
		new BarrierAura(game.party[0], game.player, planted(100))
		await settle()

		bite(game.party[0], 80)

		expect(game.party[0].health.current).toBe(40)
		expect(game.party[0].alive).toBe(true)
		expect(events('UNIT_DIED')).toHaveLength(0)
	})

	it('still kills with what the barrier could not cover', async () => {
		await start()
		game.party[0].health.set(40)
		new BarrierAura(game.party[0], game.player, planted(10))
		await settle()

		bite(game.party[0], 80)

		expect(game.party[0].alive).toBe(false)
		expect(events('UNIT_DIED')).toHaveLength(1)
	})
})

/**
 * `repeat = 1` with `delay = lifetime` means the one and only tick is the expiry. Nothing else in
 * the game uses the dials that way, so it is worth watching a clock actually do it.
 */
it('waits out its lifetime and then falls off', async () => {
	const sim = new SimLoop(ROOM)
	await start(sim)
	// Far more than a wolf can chew through, so what ends this barrier is the clock.
	const barrier = new BarrierAura(sim.party[0], sim.player, planted(100_000))
	await settle()

	const removals = () => events('SPELL_AURA_REMOVED').filter((event) => event.abilityId === 'Barrier')
	for (let time = 0; time < BarrierAura.lifetime; time += 100) {
		sim.runFrame(time)
		await settle()
	}
	expect(removals()).toHaveLength(0)
	expect(sim.party[0].auras.has(barrier)).toBe(true)

	sim.runFrame(BarrierAura.lifetime + 100)
	await settle()

	expect(removals()).toHaveLength(1)
	expect(removals()[0].wasted).toBeGreaterThan(0)
	expect(sim.party[0].auras.has(barrier)).toBe(false)
})

/**
 * The base effect heals whenever a magnitude is set, so a shield that called it would land its
 * whole pool as direct healing as well. Renew has the same trap and the same guard.
 */
it('Shield leaves a pool rather than healing', async () => {
	await start()
	game.party[0].health.set(50)

	new Shield(game.player, game.party[0]).land()
	await settle()

	expect(game.party[0].health.current).toBe(50)
	const [barrier] = [...game.party[0].auras]
	expect(barrier).toBeInstanceOf(BarrierAura)
	expect((barrier as BarrierAura).pool).toBe(Shield.magnitudesFor(game.player)[0])
	// Shares the spell's id, so the cast and every absorb report as one ability.
	expect(barrier.id).toBe('Shield')
})
