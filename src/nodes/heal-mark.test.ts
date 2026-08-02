import {afterEach, describe, expect, it} from 'vitest'
import {settle} from '../test-setup'
import {Brightest, Glow} from './attack'
import {GameLoop} from './game-loop'
import {applyHit} from './hit'
import {HEALING_THREAT_MULTIPLIER} from './threat'
import type {Unit} from './unit'

let game!: GameLoop
afterEach(() => game.disconnect())

const brightestOn = (unit: Unit) => [...unit.auras].find((aura): aura is Brightest => aura instanceof Brightest)

function heal(target: Unit, amount = 40) {
	return applyHit({
		source: game.player,
		target,
		amount,
		abilityId: 'TestHeal',
		abilityName: 'Test Heal',
		eventType: 'SPELL_HEAL',
		school: 'holy',
	})
}

describe('Glow heal-mark', () => {
	it('marks a living full-health target without changing its health', async () => {
		game = new GameLoop({party: ['Tank'], enemies: ['Sivi']})
		const tank = game.party[0]
		new Glow(game.player, game.enemies[0])
		await settle()
		const health = tank.health.current

		const landed = heal(tank)
		await settle()

		expect(landed).toBe(0)
		expect(tank.health.current).toBe(health)
		expect(brightestOn(tank)).toBeDefined()
		expect(
			game.combatLog.events.some(
				(event) => event.eventType === 'SPELL_AURA_APPLIED' && event.abilityId === Brightest.id,
			),
		).toBe(true)
	})

	it('moves its exclusive Brightest mark to the next healed ally', async () => {
		game = new GameLoop({party: ['Tank', 'Clover'], enemies: ['Sivi']})
		const [tank, clover] = game.party
		new Glow(game.player, game.enemies[0])
		await settle()

		heal(tank)
		await settle()
		expect(brightestOn(tank)).toBeDefined()

		heal(clover)
		await settle()
		expect(brightestOn(tank)).toBeUndefined()
		expect(brightestOn(clover)).toBeDefined()
	})

	it('redirects only Sivi, then falls back to ordinary threat when Brightest fades', async () => {
		game = new GameLoop({party: ['Tank', 'Clover'], enemies: ['Sivi', 'Grub']})
		const [tank, clover] = game.party
		const [sivi, grub] = game.enemies
		for (const enemy of [sivi, grub]) {
			if (!enemy.threat) throw new Error(`${enemy.name} needs a threat table`)
			enemy.threat.set(tank, 100)
		}

		expect(sivi.targeting?.pick('enemy')).toBe(tank)
		expect(grub.targeting?.pick('enemy')).toBe(tank)

		new Glow(game.player, sivi)
		await settle()
		heal(tank)
		await settle()
		expect(sivi.targeting?.pick('enemy')).toBe(tank)

		clover.health.set(clover.health.max - 40)
		heal(clover)
		await settle()

		const ordinaryHealThreat = (40 * HEALING_THREAT_MULTIPLIER) / 2
		for (const enemy of [sivi, grub]) {
			expect(enemy.threat?.get(clover)).toBe(0)
			expect(enemy.threat?.get(game.player)).toBe(ordinaryHealThreat)
		}
		expect(sivi.targeting?.pick('enemy')).toBe(clover)
		expect(grub.targeting?.pick('enemy')).toBe(tank)

		brightestOn(clover)?.disconnect()
		await settle()

		expect(sivi.targeting?.pick('enemy')).toBe(tank)
		expect(
			game.combatLog.events.some(
				(event) => event.eventType === 'SPELL_AURA_REMOVED' && event.abilityId === Brightest.id,
			),
		).toBe(true)
	})

	it('plants no mark when the healer lacks Glow', async () => {
		game = new GameLoop({party: ['Tank'], enemies: ['Sivi']})

		heal(game.party[0])
		await settle()

		expect(brightestOn(game.party[0])).toBeUndefined()
	})
})
