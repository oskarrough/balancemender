import {describe, it, expect, beforeEach} from 'vitest'
import {GameLoop} from './game-loop'
import {applyHit} from './hit'
import {PeriodicAura} from './periodic-aura'
import {Renew} from './spells'
import {combatLogs, clearLogs} from '../combatlog'

/**
 * Every heal and every hit in the game goes through `applyHit`, so what it logs is what the
 * Combat log panel, the Fight report and the simulator all see. A mechanic that changes a
 * health bar some other way is invisible to all three — DoTs used to be exactly that.
 */

const deaths = () => combatLogs.filter((event) => event.eventType === 'UNIT_DIED')

describe('applyHit', () => {
	beforeEach(() => clearLogs())

	it('reports the part of a heal that did nothing', () => {
		const game = new GameLoop({party: ['Tank'], enemies: []})
		game.tank.health.set(game.tank.health.max - 10)

		const landed = applyHit({
			source: game.player,
			target: game.tank,
			amount: 40,
			abilityId: 'Heal',
			abilityName: 'Heal',
			eventType: 'SPELL_HEAL',
		})

		expect(landed).toBe(10)
		expect(combatLogs.at(-1)).toMatchObject({
			eventType: 'SPELL_HEAL',
			sourceId: game.player.id,
			targetId: game.tank.id,
			value: 40,
			overheal: 30,
		})
		game.disconnect()
	})

	it('leaves overheal off a hit, so damage does not claim it overhealed nothing', () => {
		const game = new GameLoop({party: ['Tank'], enemies: []})
		applyHit({
			source: game.tank,
			target: game.tank,
			amount: -5,
			abilityId: 'Test',
			abilityName: 'Test',
			eventType: 'SWING_DAMAGE',
		})

		expect(combatLogs.at(-1)).toMatchObject({eventType: 'SWING_DAMAGE', value: 5})
		expect(combatLogs.at(-1)).not.toHaveProperty('overheal')
		game.disconnect()
	})

	it('announces a death once, however many more hits land on the body', () => {
		const game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf']})
		const wolf = game.enemies[0]
		const hit = (amount: number) =>
			applyHit({
				source: game.tank,
				target: wolf,
				amount,
				abilityId: 'ShieldBash',
				abilityName: 'Shield Bash',
				eventType: 'SWING_DAMAGE',
			})

		hit(-wolf.health.max)
		expect(deaths()).toHaveLength(1)
		expect(deaths()[0]).toMatchObject({targetId: wolf.id, sourceId: game.tank.id})

		hit(-10)
		expect(deaths()).toHaveLength(1)
		game.disconnect()
	})
})

describe('PeriodicAura', () => {
	beforeEach(() => clearLogs())

	// The old DoT class applied damage without logging anything at all, so a poison was
	// invisible to every report. One class for both directions is what stops that recurring.
	it('logs damage as readily as it logs healing, and credits the caster either way', async () => {
		const game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf']})
		const wolf = game.enemies[0]

		class Poison extends PeriodicAura {
			static name = 'Poison'
			static total = -50
			static interval = 1
			static repeat = 5
		}
		const poison = new Poison(wolf, game.tank)
		await Promise.resolve()
		poison.tick()

		expect(combatLogs.at(-1)).toMatchObject({
			eventType: 'SPELL_PERIODIC_DAMAGE',
			abilityName: 'Poison',
			sourceId: game.tank.id,
			targetId: wolf.id,
			value: 10,
		})
		game.disconnect()
	})

	/**
	 * The aura's number is a total over its whole life, not a per-tick one, and Renew sat
	 * at 30 for years meaning 6 a tick — a fifth of what the number implied, and
	 * less healing than Heal for more mana. Pin the total the spell advertises to the total
	 * that lands, so the two cannot drift apart again.
	 */
	it('lands the total a heal-over-time advertises, not a fraction of it', async () => {
		const game = new GameLoop({party: ['Tank'], enemies: []})
		game.tank.health.set(1)
		game.player.currentTarget = game.tank

		new Renew(game.player).land()
		await Promise.resolve()

		const renew = [...game.tank.auras].find(
			(aura): aura is PeriodicAura => aura instanceof PeriodicAura && aura.name === 'Renew',
		)
		expect(renew).toBeDefined()
		for (let i = 0; i < renew!.repeat; i++) renew!.tick()

		const healed = combatLogs
			.filter((event) => event.eventType === 'SPELL_PERIODIC_HEAL')
			.reduce((total, event) => total + (event.value ?? 0), 0)
		expect(healed).toBe(Renew.magnitude)
		game.disconnect()
	})
})
