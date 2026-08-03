import {describe, it, expect} from 'vitest'
import {GameLoop} from './game-loop'
import {Player} from './player'
import {runFight} from '../sim/run'
import {analyze} from '../sim/report'
import {MANA_PER_INTELLECT} from './stats'

/**
 * The five-second rule is the whole mechanic: casting suppresses your own regeneration, so a lull
 * is worth something. #39 claimed regen never fired at all, reasoning that a Haruk win spent
 * exactly the 600-point pool "and not one point more". That inference was wrong — it only holds if
 * the pool ends at zero, and it ended at 45. Regen was firing; it was just too small to matter.
 * These tests pin the mechanic and the size separately, because those are the two ways it breaks.
 */
describe('mana regeneration', () => {
	it('waits five seconds after a cast, then pays out once a second', () => {
		const game = new GameLoop({party: ['Tank'], enemies: []})
		const mana = game.player.mana
		// Regen also refuses to run on a full pool, so make room before asking about the rule.
		mana.set(100)
		mana.lastCastTime = 0

		game.elapsedTime = 4999
		expect(mana.regen.shouldTick()).toBe(false)
		expect(mana.regen.wait).toBe(1)
		game.elapsedTime = 5000
		expect(mana.regen.shouldTick()).toBe(true)
		expect(mana.regen.wait).toBe(0)

		mana.regen.tick()
		expect(mana.current).toBe(100 + Player.spirit)

		game.disconnect()
	})

	it('logs each payout as a mana gain, clamped to what the pool actually took', () => {
		const game = new GameLoop({party: ['Tank'], enemies: []})
		const mana = game.player.mana
		mana.set(100)
		mana.lastCastTime = 0
		game.elapsedTime = 5000
		mana.regen.tick()

		const gains = game.combatLog.events.filter((event) => event.eventType === 'RESOURCE_GAIN')
		expect(gains).toHaveLength(1)
		expect(gains[0]).toMatchObject({sourceName: 'Player', value: Player.spirit, extraInfo: 'MANA'})

		game.disconnect()
	})

	it('derives its rate from spirit, so the Balance Lab can tune it', () => {
		const game = new GameLoop({party: ['Tank'], enemies: []})
		// Captured before the tune, because the tune rewrites the static this came from.
		const shipped = Player.spirit
		expect(game.player.mana.regen.regenRate).toBe(shipped)

		expect(game.perform({type: 'tune', of: 'unit', name: 'Player', key: 'spirit', value: 40}).ok).toBe(true)
		expect(game.player.mana.regen.regenRate).toBe(40)

		const next = new GameLoop({party: ['Tank'], enemies: []})
		expect(next.player.mana.regen.regenRate).toBe(40)

		next.perform({type: 'resetBalance'})
		next.disconnect()
		game.disconnect()
	})

	/**
	 * The guard against regen quietly going back to decorative. Spending more than the pool holds
	 * is only possible if regeneration paid for the difference, so this is the arithmetic #39 got
	 * backwards, turned into an assertion.
	 *
	 * Three wolves rather than #39's Haruk, because Mend at 60 mana (#71) shrank a 60s boss fight to
	 * 540 — it now fits inside the pool with room to spare, and inflating the boss to keep this one
	 * assertion honest would undo the cheaper Mend by the back door. The wolves are the game's
	 * longest fight: 85s and ~825 mana against a 600 pool, a margin no single roll closes.
	 */
	it('lets the healer spend more than one poolful over a long fight', async () => {
		const fight = await runFight({room: {enemies: ['Runt', 'Runt', 'Runt']}, bot: 'triage', seed: 1})
		expect(fight.outcome).toBe('victory')

		const player = analyze(fight.events, fight).units.find((unit) => unit.name === 'Player')
		expect(player!.manaSpent).toBeGreaterThan(Player.intellect * MANA_PER_INTELLECT)
		expect(player!.manaGained).toBeGreaterThan(0)
		expect(player!.manaBurned).toBe(0)
		expect(player!.manaNet).toBe(player!.manaGained - player!.manaSpent - player!.manaBurned)
		expect(player!.endMana).toBe(player!.maxMana! + player!.manaNet)
	})
})
