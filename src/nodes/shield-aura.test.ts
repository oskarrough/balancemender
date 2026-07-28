import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import {GameLoop} from './game-loop'
import {SimLoop} from '../sim/run'
import {ShieldAura} from './shield-aura'
import {PowerWordShield} from './spells'
import {applyHit} from './hit'
import type {Unit} from './unit'
import type {Roster} from './encounter'
import {combatLogs, clearLogs} from '../combatlog'

/**
 * A shield is the one thing in the game that works by *not* moving a health bar, so most of what
 * is asserted here is something that did not happen — and the log entry that is the only reason
 * anyone could tell it happened at all.
 */

const flush = () => Promise.resolve()

const events = (eventType: string) => combatLogs.filter((event) => event.eventType === eventType)

const ROSTER: Roster = {party: ['Tank'], enemies: ['TinyWolf']}

let game!: GameLoop
beforeEach(() => clearLogs())
afterEach(() => game.disconnect())

/**
 * A tank, a wolf and everything mounted — where every case here starts. Reach for `game`
 * afterwards rather than a return value: a vroum Loop is thenable, so `await`ing one never
 * resolves.
 */
const start = async (loop: GameLoop = new GameLoop(ROSTER)) => {
	game = loop
	await flush()
}

const bite = (target: Unit, damage: number) =>
	applyHit({
		source: game.enemies[0],
		target,
		amount: -damage,
		abilityId: 'SavageBite',
		abilityName: 'Savage Bite',
		eventType: 'SWING_DAMAGE',
	})

describe('absorbing', () => {
	it('takes its share off a hit before the health bar moves', async () => {
		await start()
		new ShieldAura(game.tank, game.player, 20)
		await flush()

		const full = game.tank.health.current
		bite(game.tank, 50)

		expect(game.tank.health.current).toBe(full - 30)
	})

	it('leaves the bar alone when it covers the whole hit, and says so in the log', async () => {
		await start()
		new ShieldAura(game.tank, game.player, 100)
		await flush()

		const full = game.tank.health.current
		bite(game.tank, 30)

		expect(game.tank.health.current).toBe(full)
		expect(events('SPELL_ABSORBED')).toHaveLength(1)
		expect(events('SPELL_ABSORBED')[0]).toMatchObject({
			// The shield's caster, never whoever swung: prevention is credited the way healing is.
			sourceId: game.player.id,
			targetId: game.tank.id,
			abilityId: 'Shield',
			value: 30,
		})
	})

	it('spends the pool, lets the remainder land, and is gone', async () => {
		await start()
		new ShieldAura(game.tank, game.player, 20)
		await flush()

		bite(game.tank, 50)

		expect(events('SPELL_ABSORBED')[0].value).toBe(20)
		// The damage event reports what got through, not what was swung — same number the health
		// bar moved by.
		expect(events('SWING_DAMAGE')[0].value).toBe(30)
		expect([...game.tank.auras]).toHaveLength(0)
	})

	it('walks shields oldest first', async () => {
		await start()
		// Two casters, or the second would supersede the first rather than join it — see `stackKey`.
		const first = new ShieldAura(game.tank, game.player, 10)
		const second = new ShieldAura(game.tank, game.tank, 10)
		await flush()

		bite(game.tank, 15)

		expect(first.pool).toBe(0)
		expect(second.pool).toBe(5)
	})

	it('reports the pool nobody spent when it falls off', async () => {
		await start()
		const shield = new ShieldAura(game.tank, game.player, 100)
		await flush()

		bite(game.tank, 30)
		shield.disconnect()
		await flush()

		expect(events('SPELL_AURA_REMOVED')[0]).toMatchObject({abilityId: 'Shield', wasted: 70})
	})

	/**
	 * A shield recast early wastes what was left just as surely as one that timed out — but the
	 * copy it replaces is superseded, and superseding logs no removal. The refresh carries it, or
	 * nothing does and re-shielding looks free.
	 */
	it('reports the pool nobody spent when a recast replaces it', async () => {
		await start()
		new ShieldAura(game.tank, game.player, 100)
		await flush()

		bite(game.tank, 30)
		new ShieldAura(game.tank, game.player, 100)
		await flush()

		expect(events('SPELL_AURA_REMOVED')).toHaveLength(0)
		expect(events('SPELL_AURA_REFRESH')[0]).toMatchObject({abilityId: 'Shield', wasted: 70})
	})
})

/**
 * Absorb, then damage, then decide who died — in that order. Getting it wrong kills a unit the
 * shield was holding up, and no assertion on health alone would notice.
 */
describe('a killing blow through a shield', () => {
	it('does not kill what the shield covered', async () => {
		await start()
		game.tank.health.set(40)
		new ShieldAura(game.tank, game.player, 100)
		await flush()

		bite(game.tank, 80)

		expect(game.tank.health.current).toBe(40)
		expect(game.tank.alive).toBe(true)
		expect(events('UNIT_DIED')).toHaveLength(0)
	})

	it('still kills with what the shield could not cover', async () => {
		await start()
		game.tank.health.set(40)
		new ShieldAura(game.tank, game.player, 10)
		await flush()

		bite(game.tank, 80)

		expect(game.tank.alive).toBe(false)
		expect(events('UNIT_DIED')).toHaveLength(1)
	})
})

/**
 * `repeat = 1` with `delay = lifetime` means the one and only tick is the expiry. Nothing else in
 * the game uses the dials that way, so it is worth watching a clock actually do it.
 */
it('waits out its lifetime and then falls off', async () => {
	const sim = new SimLoop(ROSTER)
	await start(sim)
	// Far more than a wolf can chew through, so what ends this shield is the clock.
	const shield = new ShieldAura(sim.tank, sim.player, 100_000)
	await flush()

	const removals = () => events('SPELL_AURA_REMOVED').filter((event) => event.abilityId === 'Shield')
	for (let time = 0; time < ShieldAura.lifetime; time += 100) {
		sim.runFrame(time)
		await flush()
	}
	expect(removals()).toHaveLength(0)
	expect(sim.tank.auras.has(shield)).toBe(true)

	sim.runFrame(ShieldAura.lifetime + 100)
	await flush()

	expect(removals()).toHaveLength(1)
	expect(removals()[0].wasted).toBeGreaterThan(0)
	expect(sim.tank.auras.has(shield)).toBe(false)
})

/**
 * The base effect heals whenever a magnitude is set, so a shield that called it would land its
 * whole pool as direct healing as well. Renew has the same trap and the same guard.
 */
it('Power Word: Shield leaves a pool rather than healing', async () => {
	await start()
	game.tank.health.set(50)

	new PowerWordShield(game.player, game.tank).land()
	await flush()

	expect(game.tank.health.current).toBe(50)
	const [shield] = [...game.tank.auras]
	expect(shield).toBeInstanceOf(ShieldAura)
	expect((shield as ShieldAura).pool).toBe(PowerWordShield.magnitude)
	// Shares the spell's id, so the cast and every absorb report as one ability.
	expect(shield.id).toBe('PowerWordShield')
})
