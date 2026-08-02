import Pino from 'pino'
import type {FightLocation} from './fight-location'
import type {Condition} from './nodes/types'

// Combat event format inspired by WoW
export interface CombatLogEvent {
	/**
	 * Wall clock, for the console line and nothing else. Never measure a fight with it: a paused
	 * tab, a long frame or a slow machine stretches the gaps between events, and a simulated fight
	 * runs thousands of times faster than a played one. `time` is the fight's own clock — every
	 * reader that asks *when* goes through `at()` in `sim/report-analysis.ts`.
	 */
	timestamp: number
	/** Milliseconds into the fight. Filled in from the log's clock — see `CombatLog`. */
	time?: number
	eventType: CombatEventType
	sourceId?: string
	sourceName?: string
	targetId?: string
	targetName?: string
	abilityId?: string
	abilityName?: string
	value?: number
	/** Portion of `value` that healed a full health bar and did nothing. */
	overheal?: number
	/**
	 * Absorption a shield still had when it fell off, on `SPELL_AURA_REMOVED`. What `overheal` is
	 * for a heal, and the only trace of it in the stream: a shield nobody hit moves no health bar.
	 * Its own field because the analyzer totals it, and `extraInfo` is display text.
	 */
	wasted?: number
	/**
	 * How long this event commits the unit for, in ms — a cast's time or its global cooldown,
	 * whichever is longer. Logged so the analyzer never has to know how long a GCD lasts.
	 *
	 * Not `duration`: an aura has one of those, and it means how long the aura lasts rather than
	 * how long its caster stood still.
	 */
	busyFor?: number
	/**
	 * Which band of its health bar the target has just crossed into. Its own field rather than
	 * `extraInfo`, which is display text — the analyzer keys on this to total up how long a unit
	 * spent in trouble, and it cannot ask the game where the thresholds are: `--tune` moves them,
	 * and an analyzer holding the old number would quietly report the wrong answer.
	 */
	condition?: Condition
	extraInfo?: string
	/**
	 * The one use of an ability this event traces back to, minted per `Ability` instance. What ties
	 * a HoT's ticks to the cast that applied them — per-ability totals can say Renew overhealed 40%,
	 * only this can say *that* Renew did nothing.
	 */
	castId?: string
}

export type CombatEventType =
	| 'SPELL_CAST_START'
	| 'SPELL_CAST_SUCCESS'
	| 'SPELL_CAST_FAILED'
	| 'SPELL_CAST_INTERRUPTED'
	| 'SPELL_HEAL'
	| 'SPELL_PERIODIC_HEAL'
	| 'SPELL_DAMAGE'
	| 'SPELL_PERIODIC_DAMAGE'
	| 'SWING_DAMAGE'
	| 'RANGE_DAMAGE'
	| 'SPELL_AURA_APPLIED'
	| 'SPELL_AURA_REMOVED'
	| 'SPELL_AURA_REFRESH'
	| 'RESOURCE_GAIN'
	| 'RESOURCE_SPENT'
	| 'UNIT_DIED'
	| 'UNIT_CONDITION'
	| 'FIGHT_START'
	| 'FIGHT_END'
	| 'SWEET_SPOT_HIT'
	| 'SWEET_SPOT_MISS'
	| 'GAME_PAUSE'
	| 'GAME_RESUME'
	// Append only. A recorded log is read back by name, so reordering or renaming any of these
	// makes every fight already on disk unreadable.
	| 'SPELL_ABSORBED'

/** Bump when an event shape changes — stored fights carry this and get dropped on mismatch. */
export const COMBATLOG_SCHEMA = 1

/**
 * Where the panels hear about new events. Its own `EventTarget` rather than `document`, so the
 * stream exists in a simulation too — the game has to run without a DOM.
 *
 * The one thing here that is deliberately not per-game: the panels subscribe in
 * `connectedCallback`, on the splash, before any `GameLoop` exists. "Something changed, redraw" is
 * a UI concern rather than fight state, and a per-game channel would only mean every panel
 * re-subscribing when a game appears. Which log is talking is `CombatLog.notify`, below.
 */
export const combatEvents = new EventTarget()

/**
 * One fight's event stream. `GameLoop` owns one as `game.combatLog`, so two fights running at once
 * cannot write into each other — see [architecture](../docs/architecture.md).
 */
export class CombatLog {
	readonly events: CombatLogEvent[] = []

	/** Metadata for this fight, kept on the record rather than copied onto every event. */
	location?: FightLocation

	/**
	 * Whether anyone is watching this fight: the panels get told about new events, and the events
	 * go to the console at info level. A `SimLoop` turns it off — those events belong to a fight
	 * nobody is watching, and letting them through would redraw the live panels thousands of times
	 * off someone else's log.
	 */
	notify = true

	private castCount = 0

	/**
	 * `clock` is where `time` comes from — the game hands its own `elapsedTime`, so events are
	 * stamped with fight time rather than wall time. A simulated fight runs far faster than real
	 * time, and `Date.now()` would squash the whole fight into a few hundred ms.
	 */
	constructor(private clock: () => number = () => 0) {}

	/**
	 * Record an event. Collecting happens here rather than in a pino serializer so the log
	 * survives silencing the logger (simulations do exactly that).
	 */
	add(event: CombatLogEvent) {
		if (!event.timestamp) event.timestamp = Date.now()
		if (event.time === undefined) event.time = this.clock()
		this.events.push(event)
		if (this.notify) {
			combatEvents.dispatchEvent(new CustomEvent('combatlog-update', {detail: event}))
			logger.info({combat: event})
		}
	}

	/**
	 * Mint the id one ability use carries — see `castId` above. Counted per log, so a seeded replay
	 * mints the same ones; uniqueness only has to hold within one log.
	 */
	nextCastId(abilityId: string) {
		return `${abilityId}#${++this.castCount}`
	}

	/** Start over, ids included — a new room is not read on top of the last one. */
	clear() {
		this.events.length = 0
		this.castCount = 0
		this.location = undefined
	}
}

const formatter = new Intl.DateTimeFormat('de', {
	hour: '2-digit',
	minute: '2-digit',
	second: '2-digit',
	fractionalSecondDigits: 2,
})

interface PinoLogObject {
	msg?: string
	combat?: CombatLogEvent
	[key: string]: any
}

function formatCombatEvent(event: CombatLogEvent): string {
	const parts = [formatter.format(new Date(event.timestamp)), event.eventType]
	if (event.sourceName) parts.push(event.sourceName)
	if (event.targetName) parts.push(event.targetName)
	if (event.abilityName) parts.push(event.abilityName)
	if (event.value !== undefined) parts.push(event.value.toString())
	if (event.extraInfo) parts.push(event.extraInfo)
	return parts.join(' ')
}

export const logger = Pino({
	browser: {
		asObject: true,
		serialize: true,
		write: {
			info: (o: PinoLogObject) => {
				if (o.combat) console.debug(`[COMBAT] ${formatCombatEvent(o.combat)}`)
				else console.info(o.msg || o)
			},
			debug: (o: PinoLogObject) => console.debug(o.msg || o),
			warn: (o: PinoLogObject) => console.warn(o.msg || o),
			error: (o: PinoLogObject) => console.error(o.msg || o),
		},
	},
	serializers: {
		err: Pino.stdSerializers.err,
	},
})

/**
 * What a `createLogger()` with no argument gets. A pino child keeps the level it was born with,
 * so quieting the parent afterwards leaves its children talking — this is how a caller that has
 * not been imported yet inherits a decision made before it loads. `setLogLevel('silent')` in the
 * test setup is the one caller that needs it.
 */
let defaultLevel: Pino.LevelWithSilent = 'info'
const children: Pino.Logger[] = []

/**
 * Set the level now, and for every logger made after this. Returns the level it replaced, so a
 * caller that only wants quiet for a while can hand it back.
 *
 * The last borrowed global in the fight path, and the honest one: a process-wide logger is not
 * fight state. Two simulations at once still fight over it, so a concurrent run can be noisy —
 * never wrong. See `runFight`.
 */
export function setLogLevel(level: Pino.LevelWithSilent) {
	const previous = defaultLevel
	defaultLevel = level
	logger.level = level
	for (const child of children) child.level = level
	return previous
}

export function createLogger(logLevel: Pino.LevelWithSilent = defaultLevel) {
	const childLogger = logger.child({})
	childLogger.level = logLevel
	children.push(childLogger)
	return childLogger
}
