import Pino from 'pino'

// Combat event format inspired by WoW
export interface CombatLogEvent {
	timestamp: number
	eventType: CombatEventType
	sourceId?: string
	sourceName?: string
	targetId?: string
	targetName?: string
	spellId?: string
	spellName?: string
	value?: number
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
	| 'SPELL_DAMAGE'
	| 'SPELL_AURA_APPLIED'
	| 'SPELL_AURA_REMOVED'
	| 'SPELL_AURA_REFRESH'
	| 'RESOURCE_CHANGE'
	| 'UNIT_DIED'
	| 'ENCOUNTER_START'
	| 'ENCOUNTER_END'
	| 'SWEET_SPOT_HIT'
	| 'SWEET_SPOT_MISS'

export const EVENT_TYPE_FILTERS: CombatEventType[] = [
	'SPELL_CAST_START',
	'SPELL_CAST_SUCCESS',
	'SPELL_CAST_FAILED',
	'SPELL_HEAL',
	'SPELL_DAMAGE',
	'UNIT_DIED',
]

export const EVENT_TYPE_COLORS: Record<CombatEventType, string> = {
	SPELL_CAST_START: '#6495ED', // Blue
	SPELL_CAST_SUCCESS: '#3CB371', // Green
	SPELL_CAST_FAILED: '#CD5C5C', // Red
	SPELL_CAST_INTERRUPTED: '#FF6347', // Red-orange
	SPELL_HEAL: '#20B2AA', // Teal
	SPELL_DAMAGE: '#FF4500', // Orange-red
	SPELL_AURA_APPLIED: '#9370DB', // Purple
	SPELL_AURA_REMOVED: '#8A2BE2', // Violet
	SPELL_AURA_REFRESH: '#9932CC', // Dark orchid
	RESOURCE_CHANGE: '#DAA520', // Goldenrod
	UNIT_DIED: '#2F4F4F', // Dark slate
	ENCOUNTER_START: '#228B22', // Forest green
	ENCOUNTER_END: '#B22222', // Firebrick
	SWEET_SPOT_HIT: '#FFD700', // Gold
	SWEET_SPOT_MISS: '#C0C0C0', // Silver
}

// Store logs
export const combatLogs: CombatLogEvent[] = []

// Format timestamp with millisecond precision
const formatter = new Intl.DateTimeFormat('de', {
	hour: '2-digit',
	minute: '2-digit',
	second: '2-digit',
	fractionalSecondDigits: 2,
})

function formatTime(timestamp: number) {
	return formatter.format(new Date(timestamp))
}

// Type for Pino log objects in the browser
interface PinoLogObject {
	msg?: string
	combat?: CombatLogEvent
	[key: string]: any
}

// Format a combat event as string for display
function formatCombatEvent(event: CombatLogEvent): string {
	const parts = [formatTime(event.timestamp), event.eventType]

	if (event.sourceName) parts.push(event.sourceName)
	if (event.targetName) parts.push(event.targetName)
	if (event.spellName) parts.push(event.spellName)
	if (event.value !== undefined) parts.push(event.value.toString())
	if (event.extraInfo) parts.push(event.extraInfo)
	if (event.isAOE) parts.push('AOE')

	return parts.join(' ')
}

// Custom level for combat events
const LEVELS = {
	combat: 35, // Between info (30) and warn (40)
}

// Pino serializers
const serializers = {
	// Standard error serializer
	err: Pino.stdSerializers.err,

	// Combat event serializer
	combat: (event: CombatLogEvent) => {
		// Store the event in our array for the viewer
		combatLogs.push(event)

		// Notify the viewer about the new event
		if (typeof document !== 'undefined') {
			document.dispatchEvent(new CustomEvent('combatlog-update', {detail: event}))
		}

		// Return the event for logging
		return event
	},
}

// Browser-specific Pino logger with custom formatting
export const logger = Pino({
	// Define custom levels
	customLevels: LEVELS,

	// Use browser-specific configuration
	browser: {
		// Generate structured objects instead of passing to console directly
		asObject: true,

		// Apply serializers in the browser
		serialize: true,

		// Custom write method for browser logs
		write: {
			// Regular log levels use standard console methods
			info: (o: PinoLogObject) => {
				if (o.combat) console.debug(`[COMBAT] ${formatCombatEvent(o.combat)}`)
				else console.info(o.msg || o)
			},
			debug: (o: PinoLogObject) => console.debug(o.msg || o),
			warn: (o: PinoLogObject) => console.warn(o.msg || o),
			error: (o: PinoLogObject) => console.error(o.msg || o),

			// Custom combat level
			combat: (o: PinoLogObject) => {
				// This will be called when using logger.combat()
				if (o.combat) {
					console.debug(`[COMBAT] ${formatCombatEvent(o.combat)}`)
				} else {
					console.debug(o.msg || o)
				}
			},
		},

		// Transmit option for potential remote logging
		transmit: {
			level: 'warn', // Only transmit warnings and above
			send: (level: string) => {
				// Could send logs to a server or analytics service
				// For now, just collecting events, but this gives us a future extension point
				if (level === 'error' || level === 'fatal') {
					// Add server transmission here if needed
				}
			},
		},
	},
	serializers,
})

/**
 * Create a logger with combat capabilities
 */
export function createLogger(logLevel = 'info') {
	const childLogger = logger.child({})
	childLogger.level = logLevel
	return childLogger
}

/**
 * Log a combat event using Pino
 */
export function logCombat(event: CombatLogEvent) {
	// Set timestamp if not provided
	if (!event.timestamp) event.timestamp = Date.now()

	// Log using Pino with the combat serializer
	logger.info({combat: event})
}

/**
 * Get combat logs, optionally filtered by type
 */
export function getCombatLogs(eventType?: CombatEventType): CombatLogEvent[] {
	if (eventType) return combatLogs.filter((log) => log.eventType === eventType)
	return [...combatLogs]
}

/**
 * Clear all logs
 */
export function clearLogs() {
	combatLogs.length = 0
}
