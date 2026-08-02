import {GameLoop} from '../nodes/game-loop'
import {BotDriver, Bot, BotName} from '../nodes/bot'
import {setLogLevel, CombatLogEvent} from '../combatlog'
import {DEMO_ROOM, type RoomInput} from '../nodes/fight'
import type {Unit} from '../nodes/unit'
import {unitsOf, type Outcome, type UnitInfo} from './report'
import type {FightLocation} from '../fight-location'

export {unitsOf, type Outcome, type UnitInfo}

/**
 * A room, plus the four things a browser would have supplied: who drives, how the dice fall, how
 * time steps, when to give up. Wraps a room rather than extending it, so an authored dungeon room
 * can be run as written — `runFight({room: TheGreen.rooms[3], bot: 'triage'})`.
 */
export interface Trial {
	room?: RoomInput
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
	/** Stable dungeon location when this fight was started from a dungeon run. */
	location?: FightLocation
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
 *
 * The fight it builds owns its log, its dice and its speaker, so nothing here is borrowed from
 * anyone and two of these can run at once — see [#67](https://github.com/oskarrough/balancemender/issues/67).
 */
export async function runFight(trial: Trial = {}): Promise<FightResult> {
	const {room = DEMO_ROOM, bot = 'triage', seed = 1, maxDuration = 120_000, fps = 60} = trial
	const lineup: RoomInput = {
		...room,
		party: room.party ?? DEMO_ROOM.party,
		enemies: room.enemies ?? DEMO_ROOM.enemies,
	}

	// The one thing still process-wide: a pino level is not fight state. Combat events are already
	// quiet — `SimLoop` turns its log's `notify` off — so this only silences lifecycle chatter, and
	// two simulations at once make each other noisy rather than wrong.
	const level = setLogLevel('silent')
	let game: SimLoop | undefined
	try {
		game = new SimLoop(lineup, seed)
		await flush() // vroum mounts nodes in a microtask

		new BotDriver(game.player, bot)
		await flush()

		const frame = 1000 / fps
		let time = 0
		while (!game.gameOver && time < maxDuration) {
			// Clamp the final step to the deadline, so a timeout reads 120000 and not 120016.67.
			// Keying the loop on `time` keeps the clamped step from restarting the clock.
			time = Math.min(time + frame, maxDuration)
			game.runFrame(time)
			await flush()
		}

		if (!game.gameOver) {
			// The clock ran out with both sides standing. A real fight's `onGameOver` logs the end;
			// a timeout is a finish too. The game's own clock runs one frame behind the step that
			// fed it, so it reads the deadline rather than the frame that tripped it.
			game.elapsedTime = maxDuration
			game.combatLog.add({timestamp: Date.now(), eventType: 'FIGHT_END'})
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
			...(game.combatLog.location ? {location: game.combatLog.location} : {}),
			events: game.combatLog.events.slice(),
			units,
			survivors,
		}
	} finally {
		game?.disconnect()
		await flush()
		setLogLevel(level)
	}
}

/** Run the same room `times` over, one seed apart, to see how often it goes each way. */
export async function runFights(trial: Trial, times: number): Promise<FightResult[]> {
	const results: FightResult[] = []
	for (let i = 0; i < times; i++) {
		// `null` means real randomness, and a repeated run must stay random: folding it onto the
		// deterministic base with `?? 1` turned every run of a random sweep into seed 1's replay.
		const seed = trial.seed === null ? null : (trial.seed ?? 1) + i
		results.push(await runFight({...trial, seed}))
	}
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

	constructor(room?: RoomInput, seed: number | null = null) {
		super(room, seed)
		// Nobody is watching this fight: the live panels must not redraw off its log, and its
		// thousands of events must not reach the console.
		this.combatLog.notify = false
		// No `Audio` in node, and in a browser this would play a fight nobody can see.
		this.audio.disabled = true
	}
}

const isAlive = (c: Unit) => c.health.current > 0

/** Let vroum's queued mount/disconnect microtasks run. */
const flush = () => Promise.resolve()
