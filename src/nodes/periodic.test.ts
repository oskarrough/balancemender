// @vitest-environment happy-dom
import {describe, it, expect, beforeEach} from 'vitest'
import {GameLoop} from './game-loop'
import {PeriodicEffect} from './periodic'
import {Renew} from './spells'
import {combatLogs, clearLogs} from '../combatlog'

/**
 * `maxStacks` is what stops "cast it again" from being the best button in the game. Renew is
 * instant and the GCD is 1500ms, so copies that stack are copies that multiply the best
 * heal-per-mana in the ladder by however fast you can press it.
 */

const effectsNamed = (unit: {effects: Set<PeriodicEffect>}, name: string) =>
	[...unit.effects].filter((effect) => effect.name === name)

const auras = (spell: string) =>
	combatLogs.filter((event) => event.eventType.startsWith('SPELL_AURA') && event.spellName === spell)

describe('stack rule', () => {
	beforeEach(() => clearLogs())

	it('replaces rather than stacks by default, so a recast refreshes', async () => {
		const game = new GameLoop({party: ['Tank'], enemies: []})
		game.player.currentTarget = game.tank

		new Renew(game.player).cast()
		await Promise.resolve()
		const first = effectsNamed(game.tank, 'Renew')[0]
		first.tick()

		new Renew(game.player).cast()
		await Promise.resolve()
		const after = effectsNamed(game.tank, 'Renew')

		expect(after).toHaveLength(1)
		expect(after[0]).not.toBe(first)
		expect(first.superseded).toBe(true)
		game.disconnect()
	})

	it('keeps up to maxStacks copies and drops the one closest to expiring', async () => {
		const game = new GameLoop({party: ['Tank'], enemies: []})

		class Lifebloom extends PeriodicEffect {
			static name = 'Lifebloom'
			static total = 30
			static maxStacks = 3
		}

		const planted = []
		for (let i = 0; i < 4; i++) {
			planted.push(new Lifebloom(game.tank, game.player))
			await Promise.resolve()
		}

		const stacks = effectsNamed(game.tank, 'Lifebloom')
		expect(stacks).toHaveLength(3)
		expect(stacks).toEqual(planted.slice(1))
		expect(planted[0].superseded).toBe(true)
		game.disconnect()
	})

	it('counts casters separately, so two healers can each keep one up', async () => {
		const game = new GameLoop({party: ['Tank'], enemies: []})

		new PeriodicEffect(game.tank, game.player, 50)
		new PeriodicEffect(game.tank, game.tank, 50)
		await Promise.resolve()

		expect(effectsNamed(game.tank, 'Periodic')).toHaveLength(2)
		game.disconnect()
	})

	it('logs a refresh instead of a removal, so the log never says an effect it still has fell off', async () => {
		const game = new GameLoop({party: ['Tank'], enemies: []})
		game.player.currentTarget = game.tank

		new Renew(game.player).cast()
		await Promise.resolve()
		new Renew(game.player).cast()
		await Promise.resolve()

		expect(auras('Renew').map((event) => event.eventType)).toEqual(['SPELL_AURA_APPLIED', 'SPELL_AURA_REFRESH'])
		expect(auras('Renew')[0]).toMatchObject({sourceId: game.player.id, targetId: game.tank.id})
		game.disconnect()
	})

	it('says how many are up once there is more than one', async () => {
		const game = new GameLoop({party: ['Tank'], enemies: []})

		class Sunder extends PeriodicEffect {
			static name = 'Sunder'
			static total = -10
			static maxStacks = 5
		}
		new Sunder(game.tank, game.player)
		await Promise.resolve()
		new Sunder(game.tank, game.player)
		await Promise.resolve()

		expect(auras('Sunder').map((event) => event.extraInfo)).toEqual([undefined, '2 stacks'])
		game.disconnect()
	})
})
