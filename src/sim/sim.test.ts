// @vitest-environment happy-dom
import {describe, it, expect} from 'vitest'
import {runFight} from './run'
import {analyze} from './report'
import {parseUnits} from './roster'

/**
 * These run the actual game — real loop, real spells, real combat log — on a stepped clock.
 * A fight is deterministic per seed, so they are ordinary assertions, not flaky ones.
 */

describe('running a fight', () => {
	it('plays the demo encounter to a result', async () => {
		const fight = await runFight({seed: 1})
		expect(fight.outcome).toBe('victory')
		expect(fight.duration).toBeGreaterThan(1000)
		expect(fight.events.length).toBeGreaterThan(20)
		expect(fight.roster.map((unit) => unit.name)).toEqual(['Tank', 'Player', 'Tiny wolf'])
	})

	it('replays identically for the same seed', async () => {
		const a = await runFight({seed: 7})
		const b = await runFight({seed: 7})
		expect(b.duration).toBe(a.duration)
		expect(b.events.length).toBe(a.events.length)
	})

	it('rolls different dice for a different seed', async () => {
		const rolls = (fight: Awaited<ReturnType<typeof runFight>>) => fight.events.map((event) => event.value).join(',')
		expect(rolls(await runFight({seed: 99}))).not.toBe(rolls(await runFight({seed: 1})))
	})

	it('names duplicate units apart so the report can tell them apart', async () => {
		const fight = await runFight({enemies: ['TinyWolf', 'TinyWolf'], maxDuration: 10_000})
		expect(fight.roster.map((unit) => unit.name)).toContain('Tiny wolf 1')
		expect(fight.roster.map((unit) => unit.name)).toContain('Tiny wolf 2')
	})

	it('rejects unknown units with the list of known ones', async () => {
		await expect(runFight({enemies: ['Murloc' as never]})).rejects.toThrow(/Unknown unit.*TinyWolf/s)
	})

	it('leaves the combat log it borrowed the way it found it', async () => {
		const {combatLogs, logCombat} = await import('../combatlog')
		combatLogs.length = 0
		logCombat({timestamp: 1, eventType: 'GAME_PAUSE'})
		await runFight({maxDuration: 5000})
		expect(combatLogs).toHaveLength(1)
		expect(combatLogs[0].eventType).toBe('GAME_PAUSE')
	})

	it('does not make the live panels redraw for a fight nobody is watching', async () => {
		const {logCombat} = await import('../combatlog')
		let heard = 0
		const listener = () => heard++
		document.addEventListener('combatlog-update', listener)
		try {
			await runFight({maxDuration: 5000})
			expect(heard).toBe(0)
			// …and the notification comes back on afterwards.
			logCombat({timestamp: 1, eventType: 'GAME_PAUSE'})
			expect(heard).toBe(1)
		} finally {
			document.removeEventListener('combatlog-update', listener)
		}
	})

	it('gives the borrowed globals back even when building the fight throws', async () => {
		const {combatLogs, logCombat} = await import('../combatlog')
		const {logger} = await import('../combatlog')
		combatLogs.length = 0
		logCombat({timestamp: 1, eventType: 'GAME_PAUSE'})
		const level = logger.level

		await expect(runFight({enemies: ['Murloc' as never]})).rejects.toThrow()

		// The live game keeps its log, its logger and a real clock — not a half-torn-down simulation.
		expect(combatLogs).toHaveLength(1)
		expect(combatLogs[0].eventType).toBe('GAME_PAUSE')
		expect(logger.level).toBe(level)
	})
})

describe('healing changes the outcome', () => {
	it('a party that is healed outlasts one that is not', async () => {
		const spec = {enemies: ['TinyWolf', 'TinyWolf', 'TinyWolf'] as never, seed: 3}
		const unhealed = await runFight({...spec, policy: 'idle'})
		const healed = await runFight({...spec, policy: 'triage'})

		expect(unhealed.outcome).toBe('defeat')
		expect(healed.duration).toBeGreaterThan(unhealed.duration)
		expect(analyze(healed.events).totals.healing).toBeGreaterThan(0)
		expect(analyze(unhealed.events).totals.healing).toBe(0)
	})

	// Nakroth's spike used to be 500-700 against a 300hp tank, so the boss was unwinnable no
	// matter how well you healed. Pin both ends: a retune that puts it back out of reach, or
	// one that makes it win itself, should fail here.
	//
	// Several seeds, because one seed cannot tell a balanced fight from a lucky roll. A 25-seed
	// sweep has this at 25/25 either way, so a retune that makes the boss merely *usually*
	// winnable is a real change and should fail here rather than hide behind seed 1.
	it.each([1, 2, 3, 4, 5])('makes the boss winnable by healing and only by healing (seed %i)', async (seed) => {
		const spec = {enemies: ['Nakroth'] as never, seed}
		const unhealed = await runFight({...spec, policy: 'idle'})
		const healed = await runFight({...spec, policy: 'triage'})

		expect(unhealed.outcome).toBe('defeat')
		expect(healed.outcome).toBe('victory')
	})

	/**
	 * The difficulty ramp was inverted: three trash mobs were unwinnable while the boss was a
	 * guaranteed win, because the tank kills one enemy at a time, so an extra wolf raises incoming
	 * damage *and* lengthens the fight. #40 moved the cliff rather than flattening the curve —
	 * five wolves is still meant to be a wall, which a flat curve could not give you.
	 *
	 * Both ends pinned, because either one can regress on its own: a wolf buff puts three back out
	 * of reach, and a wolf nerf turns five into a fight you can win by out-sustaining.
	 *
	 * The winnable end is a rate, not a per-seed certainty — triage takes three wolves about four
	 * times in five. Asserting five hand-picked seeds all win was a 0.8^5 coin flip that passed on
	 * luck, and any balance-neutral change could flip one; giving the wolves a bleed did, without
	 * moving the rate at all (79% before, 80% after, n=200). The other two ends are 0% and 100%
	 * events, so those stay per-seed where a single counterexample is real information.
	 */
	const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]

	it('makes three wolves winnable but not a formality', async () => {
		const three = ['TinyWolf', 'TinyWolf', 'TinyWolf'] as never
		const outcomes = await Promise.all(SEEDS.map((seed) => runFight({enemies: three, policy: 'triage', seed})))
		const wins = outcomes.filter((fight) => fight.outcome === 'victory').length / SEEDS.length
		expect(wins).toBeGreaterThan(0.55)
		expect(wins).toBeLessThan(0.95)
	})

	it.each([1, 2, 3, 4, 5])('makes three wolves need a healer and five a wall (seed %i)', async (seed) => {
		// Still not a fight healing is irrelevant to — the control group has to keep losing it.
		const three = ['TinyWolf', 'TinyWolf', 'TinyWolf'] as never
		expect((await runFight({enemies: three, policy: 'idle', seed})).outcome).toBe('defeat')

		const five = ['TinyWolf', 'TinyWolf', 'TinyWolf', 'TinyWolf', 'TinyWolf'] as never
		expect((await runFight({enemies: five, policy: 'triage', seed})).outcome).toBe('defeat')
	})

	it('spamming the expensive heal overheals more than triaging', async () => {
		const spec = {enemies: ['TinyWolf', 'TinyWolf'] as never, seed: 5, maxDuration: 40_000}
		const overheal = async (policy: 'panic' | 'triage') => {
			const {totals} = analyze((await runFight({...spec, policy})).events)
			return totals.overhealing / (totals.overhealing + totals.healing)
		}
		expect(await overheal('panic')).toBeGreaterThan(await overheal('triage'))
	})
})

describe('parseUnits', () => {
	it('expands repeats', () => {
		expect(parseUnits('TinyWolf*3, Nakroth')).toEqual(['TinyWolf', 'TinyWolf', 'TinyWolf', 'Nakroth'])
	})

	it('ignores empty entries', () => {
		expect(parseUnits(' Tank , ')).toEqual(['Tank'])
	})
})
