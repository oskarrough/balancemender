import {afterEach, describe, expect, it} from 'vitest'
import {settle} from '../test-setup'
import {GameLoop} from './game-loop'
import {HealMarkGate, ThreatMark} from './heal-mark'
import {applyHit} from './hit'
import {prefer, Targeting} from './targeting'
import {HEALING_THREAT_MULTIPLIER} from './threat'
import type {Unit} from './unit'

/**
 * Smoke for the heal-mark base mechanism: gate on healer → mark on heal target → threat preference.
 */

class Marked extends ThreatMark {
	static id = 'Marked'
	static name = 'Marked'
	static lifetime = 5000
	static threatWeight = 6
	static exclusive = true
}

class Exposed extends HealMarkGate {
	static id = 'Exposed'
	static name = 'Exposed'
	static lifetime = 9000
	static mark = Marked
}

let game!: GameLoop
afterEach(() => game.disconnect())

const markOn = (unit: Unit) => [...unit.auras].find((aura): aura is Marked => aura instanceof Marked)

describe('heal-mark', () => {
	it('gate → heal → mark → prefer.threat keeps the patient', async () => {
		game = new GameLoop({party: ['Tank'], enemies: ['Runt']})
		const tank = game.party[0]
		const wolf = game.enemies[0]
		wolf.targeting = new Targeting(wolf, prefer.threat(wolf))
		const table = wolf.threat
		if (!table) throw new Error('Runt needs a threat table')

		table.set(tank, 100)
		table.set(game.player, 0)
		tank.health.set(tank.health.max - 40)
		new Exposed(game.player, wolf)
		await settle()

		applyHit({
			source: game.player,
			target: tank,
			amount: 40,
			abilityId: 'TestHeal',
			abilityName: 'Test Heal',
			eventType: 'SPELL_HEAL',
			school: 'holy',
		})
		await settle()

		const expected = 40 * Marked.threatWeight * HEALING_THREAT_MULTIPLIER
		expect(markOn(tank)).toBeDefined()
		expect(markOn(game.player)).toBeUndefined()
		expect(table.get(tank)).toBe(100 + expected)
		expect(table.get(game.player)).toBe(0)
		expect(wolf.targeting.pick('enemy')).toBe(tank)
	})

	it('plants no mark when the healer lacks the gate', async () => {
		game = new GameLoop({party: ['Tank'], enemies: ['Runt']})
		const tank = game.party[0]
		tank.health.set(tank.health.max - 40)

		applyHit({
			source: game.player,
			target: tank,
			amount: 40,
			abilityId: 'TestHeal',
			abilityName: 'Test Heal',
			eventType: 'SPELL_HEAL',
			school: 'holy',
		})
		await settle()

		expect(markOn(tank)).toBeUndefined()
	})
})
