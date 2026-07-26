import Pino from 'pino'

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
	spellId?: string
	spellName?: string
	value?: number
	/** Portion of `value` that healed a full health bar and did nothing. */
	overheal?: number
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
	| 'ENCOUNTER_START'
	| 'ENCOUNTER_END'
	| 'SWEET_SPOT_HIT'
	| 'SWEET_SPOT_MISS'
	| 'GAME_PAUSE'
	| 'GAME_RESUME'

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
	if (event.spellName) parts.push(event.spellName)
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

export function createLogger(logLevel = 'info') {
	const childLogger = logger.child({})
	childLogger.level = logLevel
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
	if (typeof document !== 'undefined') {
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
