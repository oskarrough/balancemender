import Pino from 'pino'
import type {Condition} from './nodes/types'

// Combat event format inspired by WoW
export interface CombatLogEvent {
	timestamp: number
	/** Milliseconds into the fight. Filled in from the clock — see `setCombatClock`. */
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
	isAOE?: boolean
	groupId?: string
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
	| 'ENCOUNTER_START'
	| 'ENCOUNTER_END'
	| 'SWEET_SPOT_HIT'
	| 'SWEET_SPOT_MISS'
	| 'GAME_PAUSE'
	| 'GAME_RESUME'
	// Append only. A recorded log is read back by name, so reordering or renaming any of these
	// makes every fight already on disk unreadable.
	| 'SPELL_ABSORBED'

export const combatLogs: CombatLogEvent[] = []

/**
 * Where `time` comes from. The GameLoop points this at its own `elapsedTime` when it mounts,
 * so events are stamped with fight time rather than wall time — a simulated fight runs far
 * faster than real time, and `Date.now()` would squash the whole fight into a few hundred ms.
 */
let clock: () => number = () => 0

/** Returns the clock it replaced, so a temporary swap can put it back. */
export function setCombatClock(fn: () => number) {
	const previous = clock
	clock = fn
	return previous
}

/**
 * Whether the panels get told about new events. A simulation borrows the log and turns this
 * off: those events belong to a fight nobody is watching, and letting them through would make
 * the live Combat log and Fight report redraw thousands of times off someone else's log.
 */
let notifying = true

/** Returns the setting it replaced, so a temporary swap can put it back. */
export function setCombatNotify(enabled: boolean) {
	const previous = notifying
	notifying = enabled
	return previous
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
	if (event.isAOE) parts.push('AOE')
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
 * caller that only wants quiet for a while can hand it back — the same borrow-and-restore shape as
 * `setCombatClock` and `setCombatNotify` below.
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

/**
 * Record a combat event. Collecting happens here rather than in a pino serializer so the
 * log survives silencing the logger (simulations do exactly that).
 */
export function logCombat(event: CombatLogEvent) {
	if (!event.timestamp) event.timestamp = Date.now()
	if (event.time === undefined) event.time = clock()
	combatLogs.push(event)
	if (notifying && typeof document !== 'undefined') {
		document.dispatchEvent(new CustomEvent('combatlog-update', {detail: event}))
	}
	logger.info({combat: event})
}

export function getCombatLogs(eventType?: CombatEventType): CombatLogEvent[] {
	if (eventType) return combatLogs.filter((log) => log.eventType === eventType)
	return [...combatLogs]
}

export function clearLogs() {
	combatLogs.length = 0
}
