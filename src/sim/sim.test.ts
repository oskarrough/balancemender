import {describe, it, expect} from 'vitest'
import {combatEvents} from '../combatlog'
import {GameLoop} from '../nodes/game-loop'
import {settle} from '../test-setup'
import {runFight, runFights} from './run'
import {analyze} from './report'
import {parseUnits} from './roster'
import {formatFight} from './format'
import {TheRust, TheGreen} from '../nodes/dungeon'
import type {Room} from '../nodes/fight'

const normalizeEvents = (fight: Awaited<ReturnType<typeof runFight>>) => {
	const names = new Map(fight.units.map((unit) => [unit.id, unit.name]))
	return fight.events.map((event) => ({
		...event,
		timestamp: 0,
		sourceId: event.sourceId ? names.get(event.sourceId) : undefined,
		targetId: event.targetId ? names.get(event.targetId) : undefined,
	}))
}

/**
 * These run the actual game — real loop, real spells, real combat log — on a stepped clock.
 * A fight is deterministic per seed, so they are ordinary assertions, not flaky ones.
 */

describe('running a fight', () => {
	it('plays the demo fight to a result', async () => {
		const fight = await runFight({seed: 1})
		expect(fight.outcome).toBe('victory')
		expect(fight.duration).toBeGreaterThan(1000)
		expect(fight.events.length).toBeGreaterThan(20)
		expect(fight.units.map((unit) => unit.name)).toEqual(['Oak', 'Player', 'Runt'])
		expect(formatFight(fight)).toMatch(/^Oak \+ Player  vs  Runt/)
	})

	it('replays identically for the same seed', async () => {
		const a = await runFight({seed: 7})
		const b = await runFight({seed: 7})
		expect(b.duration).toBe(a.duration)
		expect(normalizeEvents(b)).toEqual(normalizeEvents(a))
	})

	it('rolls different dice for a different seed', async () => {
		const rolls = (fight: Awaited<ReturnType<typeof runFight>>) => fight.events.map((event) => event.value).join(',')
		expect(rolls(await runFight({seed: 99}))).not.toBe(rolls(await runFight({seed: 1})))
	})

	it('clamps a timeout to the deadline and ends its log like any other fight', async () => {
		const fight = await runFight({room: {party: [], enemies: ['Runt']}, bot: 'idle', seed: 1, maxDuration: 5000})
		expect(fight.outcome).toBe('timeout')
		expect(fight.duration).toBe(5000)
		expect(fight.events.at(-1)).toMatchObject({eventType: 'FIGHT_END'})
	})

	it('keeps a null seed random across repeated runs', async () => {
		const [a, b] = await runFights({room: {enemies: ['Runt']}, seed: null, maxDuration: 5000}, 2)
		expect(a.seed).toBeNull()
		expect(b.seed).toBeNull()
	})

	it('walks deterministic seeds one apart when a seed is given', async () => {
		const [a, b] = await runFights({room: {enemies: ['Runt']}, seed: 3, maxDuration: 5000}, 2)
		expect(a.seed).toBe(3)
		expect(b.seed).toBe(4)
	})

	it('names duplicate units apart so the report can tell them apart', async () => {
		const fight = await runFight({room: {enemies: ['Runt', 'Runt']}, maxDuration: 10_000})
		expect(fight.units.map((unit) => unit.name)).toContain('Runt 1')
		expect(fight.units.map((unit) => unit.name)).toContain('Runt 2')
	})

	it('rejects unknown units with the list of known ones', async () => {
		await expect(runFight({room: {enemies: ['Murloc' as never]}})).rejects.toThrow(/Unknown unit.*Runt/s)
	})

	it('leaves the log of the game you are playing alone', async () => {
		const live = new GameLoop({party: [], enemies: ['Runt']})
		try {
			await settle() // let the live fight log its own FIGHT_START first
			live.combatLog.add({timestamp: 1, eventType: 'GAME_PAUSE'})
			const before = live.combatLog.events.length

			await runFight({maxDuration: 5000})

			expect(live.combatLog.events).toHaveLength(before)
			expect(live.combatLog.events.at(-1)?.eventType).toBe('GAME_PAUSE')
		} finally {
			live.disconnect()
		}
	})

	it('does not make the live panels redraw for a fight nobody is watching', async () => {
		const live = new GameLoop({party: [], enemies: ['Runt']})
		await settle() // its own FIGHT_START, before anyone is counting
		let heard = 0
		const listener = () => heard++
		combatEvents.addEventListener('combatlog-update', listener)
		try {
			await runFight({maxDuration: 5000})
			expect(heard).toBe(0)
			// …while a fight someone *is* watching still reaches them.
			live.combatLog.add({timestamp: 1, eventType: 'GAME_PAUSE'})
			expect(heard).toBe(1)
		} finally {
			live.disconnect()
			combatEvents.removeEventListener('combatlog-update', listener)
		}
	})

	it('gives the log level back even when building the fight throws', async () => {
		// The one thing a fight still borrows from the process. Everything else it owns.
		const {logger} = await import('../combatlog')
		const level = logger.level
		await expect(runFight({room: {enemies: ['Murloc' as never]}})).rejects.toThrow()
		expect(logger.level).toBe(level)
	})
})

/**
 * Two fights at once used to be two fights writing into one combat log and one dice stream: every
 * result came back holding everyone's events, and the first fight to finish dropped the rest to
 * `Math.random`. A fight owns both now, so this is a property of the design rather than of a
 * queue — see [#67](https://github.com/oskarrough/balancemender/issues/67).
 */
describe('fights running at the same time', () => {
	const SEEDS = [1, 2, 3, 4]
	const trial = (seed: number) => ({room: {enemies: ['Runt', 'Runt'] as never}, seed, maxDuration: 20_000})

	it('gives each fight its own log and the outcome it would have had alone', async () => {
		const concurrent = await Promise.all(SEEDS.map((seed) => runFight(trial(seed))))

		const sequential = []
		for (const seed of SEEDS) sequential.push(await runFight(trial(seed)))

		for (const [i, fight] of concurrent.entries()) {
			// Every event names a unit that was in *this* fight. The old failure was ~75% foreign.
			const ours = new Set(fight.units.map((unit) => unit.id))
			for (const event of fight.events) {
				if (event.sourceId !== undefined) expect(ours.has(event.sourceId)).toBe(true)
				if (event.targetId !== undefined) expect(ours.has(event.targetId)).toBe(true)
			}

			expect(fight.outcome).toBe(sequential[i].outcome)
			expect(fight.duration).toBe(sequential[i].duration)
			expect(fight.events.length).toBe(sequential[i].events.length)
			expect(normalizeEvents(fight)).toEqual(normalizeEvents(sequential[i]))
		}
	})
})

describe('healing changes the outcome', () => {
	it('a party that is healed outlasts one that is not', async () => {
		const trial = {room: {enemies: ['Runt', 'Runt', 'Runt'] as never}, seed: 3}
		const unhealed = await runFight({...trial, bot: 'idle'})
		const healed = await runFight({...trial, bot: 'triage'})

		expect(unhealed.outcome).toBe('defeat')
		expect(healed.duration).toBeGreaterThan(unhealed.duration)
		expect(analyze(healed.events).totals.healing).toBeGreaterThan(0)
		expect(analyze(unhealed.events).totals.healing).toBe(0)
	})

	// Haruk's spike used to be 500-700 against a 300hp tank, so the boss was unwinnable no
	// matter how well you healed. Pin both ends: a retune that puts it back out of reach, or
	// one that makes it win itself, should fail here.
	//
	// Several seeds, because one seed cannot tell a balanced fight from a lucky roll. A 25-seed
	// sweep has this at 25/25 either way, so a retune that makes the boss merely *usually*
	// winnable is a real change and should fail here rather than hide behind seed 1.
	it.each([1, 2, 3, 4, 5])('makes the boss winnable by healing and only by healing (seed %i)', async (seed) => {
		const trial = {room: {enemies: ['Haruk'] as never}, seed}
		const unhealed = await runFight({...trial, bot: 'idle'})
		const healed = await runFight({...trial, bot: 'triage'})

		expect(unhealed.outcome).toBe('defeat')
		expect(healed.outcome).toBe('victory')
	})

	/**
	 * The difficulty ramp was inverted: three wolves were unwinnable while the boss was a
	 * guaranteed win, because the tank kills one enemy at a time, so an extra wolf raises incoming
	 * damage *and* lengthens the fight. #40 moved the cliff rather than flattening the curve —
	 * five wolves is still meant to be a wall, which a flat curve could not give you.
	 *
	 * Pin reachability and the two walls, not the exact three-wolf win rate. A targeting mechanic
	 * can legitimately move that rate without changing any damage or healing number; the sweep is
	 * where that balance consequence is measured.
	 */
	const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]

	it('keeps three wolves within reach', async () => {
		const three = ['Runt', 'Runt', 'Runt'] as never
		const outcomes = await Promise.all(SEEDS.map((seed) => runFight({room: {enemies: three}, bot: 'triage', seed})))
		const wins = outcomes.filter((fight) => fight.outcome === 'victory').length / SEEDS.length
		expect(wins).toBeGreaterThan(0.55)
	})

	it.each([1, 2, 3, 4, 5])('makes three wolves need a healer and five a wall (seed %i)', async (seed) => {
		// Still not a fight healing is irrelevant to — the control group has to keep losing it.
		const three = ['Runt', 'Runt', 'Runt'] as never
		expect((await runFight({room: {enemies: three}, bot: 'idle', seed})).outcome).toBe('defeat')

		const five = ['Runt', 'Runt', 'Runt', 'Runt', 'Runt'] as never
		expect((await runFight({room: {enemies: five}, bot: 'triage', seed})).outcome).toBe('defeat')
	})

	/**
	 * Averaged over seeds, and against a boss rather than two wolves. Overheal is a ratio of heal
	 * size to the hole it lands in, so it only separates the two bots where the holes are deep: with
	 * the middle heal removed (#71), the *expensive* heal is also the *small* one — Patch lands 100
	 * for 80 mana where triage's Mend lands 145 for 60 — so on a shallow fight triage spills more
	 * per cast than panic does and wins this comparison on 17 of 20 seeds. What panic wastes there is mana, not
	 * healing. Haruk's arrow digs holes big enough that reaching for the small fast heal every time
	 * is visibly the wrong call: 9 of 10 seeds, and a wide enough gap that the mean is not a coin
	 * flip.
	 */
	it('spamming the expensive heal overheals more than triaging', async () => {
		const overheal = async (bot: 'panic' | 'triage', seed: number) => {
			const {totals} = analyze((await runFight({room: {enemies: ['Haruk']}, bot, seed})).events)
			return totals.overhealing / (totals.overhealing + totals.healing)
		}
		const mean = async (bot: 'panic' | 'triage') => {
			const shares = await Promise.all([1, 2, 3, 4, 5].map((seed) => overheal(bot, seed)))
			return shares.reduce((sum, share) => sum + share, 0) / shares.length
		}
		expect(await mean('panic')).toBeGreaterThan(await mean('triage'))
	})
})

/**
 * The first room used to have no losing state at all: a player who only healed out-regenerated a
 * 2 dps pup until the clock ran out, and one who only attacked was never below 90%. `Pounce` is
 * what makes it a fight, so these pin that it stayed one.
 */
describe('the first room', () => {
	const room = TheGreen.rooms[0]

	it('opens with Mend and Lance, then grants Patch for the skulker', () => {
		expect(room.grants).toEqual(['Mend', 'Lance'])
		expect(TheGreen.rooms[2]).toMatchObject({name: 'The skulker', grants: ['Patch']})
		expect(TheGreen.rooms[4]).toMatchObject({name: 'Haruk', grants: ['Shield']})
	})

	it('kills a player who never fights back', async () => {
		const fight = await runFight({room, bot: 'triage', seed: 1})
		expect(fight.outcome).toBe('defeat')
	})

	it('is won by one who does', async () => {
		const fight = await runFight({room, bot: 'lance', seed: 1})
		expect(fight.outcome).toBe('victory')
	})
})

/** The sequel opens by rewarding efficient spell choice rather than raw Patch throughput. */
describe('The Rust room one', () => {
	const room = TheRust.rooms[0]

	it('is won cleanly with efficient healing', async () => {
		const fight = await runFight({room, bot: 'renew', seed: 1})
		expect(fight.outcome).toBe('victory')
		expect(fight.survivors.party).toBe(3)
	})

	it('punishes expensive heal spam', async () => {
		const fight = await runFight({room, bot: 'panic', seed: 1})
		expect(fight.outcome).toBe('defeat')
	})
})

/** Room two puts five bodies up and two kites on whoever is worst off, and is still a step. */
describe('The Rust room two', () => {
	const first = TheRust.rooms[0]
	const second = TheRust.rooms[1]

	it('is winnable with efficient healing', async () => {
		const fight = await runFight({room: second, bot: 'renew', seed: 1})
		expect(fight.outcome).toBe('victory')
		expect(fight.survivors.party).toBe(3)
	})

	/**
	 * Counted over seeds rather than pinned to one, because one seed cannot tell a harder room from
	 * a worse roll — this used to assert a defeat at seed 9, and every retune since has had to
	 * relitigate whether that seed still meant anything.
	 */
	it('is harder than the opening room', async () => {
		const losses = async (room: Room) => {
			const outcomes = []
			for (let seed = 1; seed <= 12; seed++) outcomes.push((await runFight({room, bot: 'renew', seed})).outcome)
			return outcomes.filter((outcome) => outcome !== 'victory').length
		}
		expect(await losses(second)).toBeGreaterThan(await losses(first))
	})
})

/**
 * Fair warning before Roha: a reactive healer survives the two Bell swings, and Steep is the answer
 * that turns a cut cast into a payout rather than a hole (#84).
 */
describe('The Rust room three', () => {
	const room = TheRust.rooms[2]

	it('is the hung-bell rehearsal: triage survives, Steep keeps the cut from costing a body', async () => {
		expect(room).toMatchObject({name: 'The hung bell', enemies: ['Wether', 'Chafer', 'Chafer']})
		expect((await runFight({room, bot: 'idle', seed: 1})).outcome).toBe('defeat')
		expect((await runFight({room, bot: 'triage', seed: 1})).outcome).toBe('victory')
		// Seed 2 is a cut Mend that drops a party member under triage and does not under Steep.
		expect((await runFight({room, bot: 'triage', seed: 2})).survivors.party).toBe(2)
		expect((await runFight({room, bot: 'steep', seed: 2})).survivors.party).toBe(3)
	})
})

/** Wren must not shorten the closer until the healer can sit idle through its whole rhythm. */
describe('The Rust room four', () => {
	const room = TheRust.rooms[3]

	it('needs healing, and is won by answering Toll with Steep', async () => {
		expect(room.name).toBe('Roha')
		expect((await runFight({room, bot: 'idle', seed: 1})).outcome).toBe('defeat')
		expect((await runFight({room, bot: 'steep', seed: 1})).outcome).toBe('victory')
	})
})

describe('parseUnits', () => {
	it('expands repeats', () => {
		expect(parseUnits('Runt*3, Haruk')).toEqual(['Runt', 'Runt', 'Runt', 'Haruk'])
	})

	it('ignores empty entries', () => {
		expect(parseUnits(' Tank , ')).toEqual(['Tank'])
	})
})
