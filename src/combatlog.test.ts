import {describe, it, expect, beforeEach, vi} from 'vitest'
import {CombatLogEvent, combatLogs, clearLogs, getCombatLogs, logCombat} from './combatlog'

// Simply mock document for the combatlog.ts file
vi.mock('./utils', () => ({
	html: vi.fn(),
	formatTimestamp: vi.fn(),
}))

// Mock the document object only for the methods actually used
vi.stubGlobal('document', {
	querySelector: vi.fn(),
	dispatchEvent: vi.fn(),
})

describe('Combat Log System', () => {
	beforeEach(() => {
		// Clear logs before each test
		clearLogs()
	})

	it('should add events to the combat log array', () => {
		// Create test event
		const testEvent: CombatLogEvent = {
			timestamp: 1625097600000,
			eventType: 'SPELL_CAST_SUCCESS',
			sourceName: 'Player',
			spellName: 'Fireball',
		}

		// Log the event
		logCombat(testEvent)

		// Check if our event is in the array
		expect(combatLogs.length).toBe(1)
		expect(combatLogs[0]).toEqual(testEvent)
	})

	it('should filter logs by event type', () => {
		// Create test events
		const healEvent: CombatLogEvent = {
			timestamp: 1625097600000,
			eventType: 'SPELL_HEAL',
			sourceName: 'Player',
			targetName: 'Target',
			spellName: 'Heal',
			value: 100,
		}

		const damageEvent: CombatLogEvent = {
			timestamp: 1625097600000,
			eventType: 'SPELL_DAMAGE',
			sourceName: 'Player',
			targetName: 'Target',
			spellName: 'Fireball',
			value: 100,
		}

		// Log both events
		logCombat(healEvent)
		logCombat(damageEvent)

		// Test filtering
		const healEvents = getCombatLogs('SPELL_HEAL')
		expect(healEvents.length).toBe(1)
		expect(healEvents[0]).toEqual(healEvent)

		const damageEvents = getCombatLogs('SPELL_DAMAGE')
		expect(damageEvents.length).toBe(1)
		expect(damageEvents[0]).toEqual(damageEvent)
	})

	it('should clear logs when requested', () => {
		// Log a test event
		logCombat({
			timestamp: 1625097600000,
			eventType: 'SPELL_CAST_SUCCESS',
			sourceName: 'Player',
			spellName: 'Fireball',
		})

		// Verify log was added
		expect(combatLogs.length).toBe(1)

		// Clear logs
		clearLogs()

		// Verify logs are empty
		expect(combatLogs.length).toBe(0)
	})
})
