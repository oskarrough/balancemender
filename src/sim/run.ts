import {GameLoop} from '../nodes/game-loop'
import {AudioPlayer} from '../nodes/audio'
import {BotDriver, Bot, BotName} from '../nodes/bot'
import {combatLogs, setCombatClock, setCombatNotify, setLogLevel, CombatLogEvent} from '../combatlog'
import {setSeed} from '../rng'
import {DEMO_ROSTER, Roster} from '../nodes/encounter'
import type {Unit} from '../nodes/unit'

export type Outcome = 'victory' | 'defeat' | 'timeout'

export interface FightSpec extends Roster {
	/** How the healer plays. See `src/nodes/bot.ts`. */
	bot?: BotName | Bot
	/** Fix the dice so the fight replays exactly. `null` for real randomness. */
	seed?: number | null
	/** Give up after this much fight time (ms). */
	maxDuration?: number
	/** Frames per second to simulate. The browser runs ~60. */
	fps?: number
}

/** Who was in a fight. Not a `Roster` — that is the spec you spawn *from*. */
export interface UnitInfo {
	id: string
	name: string
	maxHealth: number
	faction: string
}

export interface FightResult {
	spec: FightSpec
	seed: number | null
	outcome: Outcome
	/** Fight time in ms. */
	duration: number
	events: CombatLogEvent[]
	units: UnitInfo[]
	survivors: {party: number; enemies: number}
}

/**
 * Run one fight to the end and hand back its combat log.
 *
 * This is the real game — the real GameLoop, units, spells and combat log — with two
 * substitutions: the browser's frame clock is replaced by a fixed step, so a two-minute
 * fight resolves in milliseconds, and the healer is played by a `BotDriver`.
 */
export async function runFight(spec: FightSpec = {}): Promise<FightResult> {
	const {bot = 'triage', seed = 1, maxDuration = 120_000, fps = 60} = spec
	const lineup: Roster = {party: spec.party ?? DEMO_ROSTER.party, enemies: spec.enemies ?? DEMO_ROSTER.enemies}

	// Everything below borrows process-global state. It all has to happen inside the try,
	// or a throw while building the fight leaves the live game holding a silenced logger,
	// a frozen clock and someone else's combat log.
	const restoreLog = borrowCombatLog()
	// A simulated fight logs thousands of lines in a second — keep it to the combat log.
	const level = setLogLevel('silent')
	// A second GameLoop claims AudioPlayer.global, so give the live game its speaker back after.
	const liveAudio = AudioPlayer.global
	let game: SimLoop | undefined
	try {
		setSeed(seed)

		game = new SimLoop(lineup)
		game.audio.disabled = true
		await flush() // vroum mounts nodes in a microtask

		new BotDriver(game.player, bot)
		await flush()

		const frame = 1000 / fps
		let time = 0
		while (!game.gameOver && game.elapsedTime < maxDuration) {
			time += frame
			game.runFrame(time)
			await flush()
		}

		const units = unitsOf(game)
		const survivors = {
			party: game.party.filter(isAlive).length,
			enemies: game.enemies.filter(isAlive).length,
		}
		const outcome: Outcome = !survivors.party ? 'defeat' : !survivors.enemies ? 'victory' : 'timeout'

		return {
			spec,
			seed,
			outcome,
			duration: Math.round(game.elapsedTime),
			events: combatLogs.slice(),
			units,
			survivors,
		}
	} finally {
		game?.disconnect()
		await flush()
		AudioPlayer.global = liveAudio
		setLogLevel(level)
		setSeed(null)
		restoreLog()
	}
}

/** Run the same fight `times` over, one seed apart, to see how often it goes each way. */
export async function runFights(spec: FightSpec, times: number): Promise<FightResult[]> {
	const base = spec.seed ?? 1
	const results: FightResult[] = []
	for (let i = 0; i < times; i++) results.push(await runFight({...spec, seed: base + i}))
	return results
}

/**
 * A GameLoop that never asks the browser for a frame — the simulation supplies them.
 * Without this a simulated fight would fight the real animation frames for the clock.
 */
export class SimLoop extends GameLoop {
	/**
	 * Advance every task to `time` (ms since the fight started). `_runTasks` is private to
	 * vroum's Loop and lives on the instance, so it is reached by name; a vroum upgrade that
	 * renames it throws on the first frame, which is loud enough to need no guard.
	 */
	runFrame(time: number) {
		;(this as unknown as {_runTasks(t: number): void})._runTasks(time)
	}
}

// `_requestNextFrame` is private too, and gets replaced on the prototype rather than
// overridden — the effect is the same: no frame is ever requested. This one fails *quietly*
// if it is ever renamed: the assignment would add a no-op nobody calls, vroum would go on
// requesting real animation frames, and simulations would start racing the browser for the
// clock. So check there is something here to replace.
if (typeof (GameLoop.prototype as unknown as {_requestNextFrame?: unknown})._requestNextFrame !== 'function') {
	throw new Error("vroum's Loop has no _requestNextFrame() — src/sim/run.ts drives the clock by replacing it")
}
Object.assign(SimLoop.prototype, {_requestNextFrame() {}})

const isAlive = (c: Unit) => c.health.current > 0

/** Who is in this fight — the analyzer needs starting health to rebuild the health graph. */
export function unitsOf(game: GameLoop): UnitInfo[] {
	return game.encounter.units.map((c) => ({
		id: c.id,
		name: c.name || c.constructor.name,
		maxHealth: c.health.max,
		faction: c.faction,
	}))
}

/** Let vroum's queued mount/disconnect microtasks run. */
const flush = () => Promise.resolve()

/**
 * Take the combat log for the duration of a fight and give it back afterwards, so simulating
 * from inside a live game doesn't eat the log of the fight you are playing.
 */
function borrowCombatLog() {
	const previous = combatLogs.splice(0, combatLogs.length)
	const previousClock = setCombatClock(() => 0)
	// The panels listen on `document` — a simulated fight is not theirs to redraw.
	const previousNotify = setCombatNotify(false)
	return () => {
		combatLogs.length = 0
		combatLogs.push(...previous)
		setCombatClock(previousClock)
		setCombatNotify(previousNotify)
	}
}
