// @vitest-environment happy-dom
import {describe, it, expect, beforeEach} from 'vitest'
import {GameLoop} from './game-loop'
import {applyHit} from './hit'
import {PeriodicEffect} from './periodic'
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
			spell: 'Heal',
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
		applyHit({source: game.tank, target: game.tank, amount: -5, spell: 'Test', eventType: 'SWING_DAMAGE'})

		expect(combatLogs.at(-1)).toMatchObject({eventType: 'SWING_DAMAGE', value: 5})
		expect(combatLogs.at(-1)).not.toHaveProperty('overheal')
		game.disconnect()
	})

	it('announces a death once, however many more hits land on the body', () => {
		const game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf']})
		const wolf = game.enemies[0]
		const hit = (amount: number) =>
			applyHit({source: game.tank, target: wolf, amount, spell: 'Shield Bash', eventType: 'SWING_DAMAGE'})

		hit(-wolf.health.max)
		expect(deaths()).toHaveLength(1)
		expect(deaths()[0]).toMatchObject({targetId: wolf.id, sourceId: game.tank.id})

		hit(-10)
		expect(deaths()).toHaveLength(1)
		game.disconnect()
	})
})

describe('PeriodicEffect', () => {
	beforeEach(() => clearLogs())

	// The old DoT class applied damage without logging anything at all, so a poison was
	// invisible to every report. One class for both directions is what stops that recurring.
	it('logs damage as readily as it logs healing, and credits the caster either way', async () => {
		const game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf']})
		const wolf = game.enemies[0]

		class Poison extends PeriodicEffect {
			static name = 'Poison'
			static amount = -50
			static interval = 1
			static repeat = 5
		}
		const poison = new Poison(wolf, game.tank)
		await Promise.resolve()
		poison.tick()

		expect(combatLogs.at(-1)).toMatchObject({
			eventType: 'SPELL_PERIODIC_DAMAGE',
			spellName: 'Poison',
			sourceId: game.tank.id,
			targetId: wolf.id,
			value: 10,
		})
		game.disconnect()
	})
})
