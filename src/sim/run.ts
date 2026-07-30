import {GameLoop} from '../nodes/game-loop'
import {AudioPlayer} from '../nodes/audio'
import {BotDriver, Bot, BotName} from '../nodes/bot'
import {combatLogs, setCombatClock, setCombatNotify, setLogLevel, CombatLogEvent} from '../combatlog'
import {setSeed} from '../rng'
import {DEMO_ROOM, Room} from '../nodes/fight'
import type {Unit} from '../nodes/unit'
import {unitsOf, type Outcome, type UnitInfo} from './report'

export {unitsOf, type Outcome, type UnitInfo}

/**
 * A room, plus the four things a browser would have supplied: who drives, how the dice fall, how
 * time steps, when to give up. Wraps a room rather than extending it, so an authored dungeon room
 * can be run as written — `runFight({room: WolfWoods.rooms[3], bot: 'triage'})`.
 */
export interface Trial {
	room?: Room
	/** How the healer plays. See `src/nodes/bot.ts`. */
	bot?: BotName | Bot
	/** Fix the dice so the fight replays exactly. `null` for real randomness. */
	seed?: number | null
	/** Give up after this much fight time (ms). */
	maxDuration?: number
	/** Frames per second to simulate. The browser runs ~60. */
	fps?: number
}

export interface FightResult {
	trial: Trial
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
export async function runFight(trial: Trial = {}): Promise<FightResult> {
	const {room = DEMO_ROOM, bot = 'triage', seed = 1, maxDuration = 120_000, fps = 60} = trial
	const lineup: Room = {party: room.party ?? DEMO_ROOM.party, enemies: room.enemies ?? DEMO_ROOM.enemies}

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
			trial,
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

/** Run the same room `times` over, one seed apart, to see how often it goes each way. */
export async function runFights(trial: Trial, times: number): Promise<FightResult[]> {
	const base = trial.seed ?? 1
	const results: FightResult[] = []
	for (let i = 0; i < times; i++) results.push(await runFight({...trial, seed: base + i}))
	return results
}

/**
 * A GameLoop that never asks the browser for a frame — the simulation supplies them through
 * `runFrame(time)`. Without this a simulated fight would race the real animation frames for the
 * clock.
 */
export class SimLoop extends GameLoop {
	protected requestFrame() {}

	/**
	 * A fixed step is the whole clock here, so every step has to land in full. `--fps 5` steps
	 * 200ms at a time, and the browser's stall clamp would quietly run that fight at half speed.
	 */
	maxFrameTime = Infinity
}

const isAlive = (c: Unit) => c.health.current > 0

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
