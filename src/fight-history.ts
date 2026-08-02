import {createStore} from 'tinybase'
import {createIndexedDbPersister} from 'tinybase/persisters/persister-indexed-db'
import type {FightLocation} from './fight-location'
import type {Outcome, UnitInfo} from './sim/report'
import {COMBATLOG_SCHEMA, type CombatLogEvent} from './combatlog'

const DB_NAME = 'balancemender-fight-history-v1'
const TABLE = 'fights'

export const MAX_FIGHTS = 40

export interface StoredFightMeta {
	id: string
	timestamp: number
	outcome: Outcome
	duration: number
	location?: FightLocation
}

export interface StoredFight extends StoredFightMeta {
	events: CombatLogEvent[]
	units: UnitInfo[]
}

const store = createStore()
const persister = createIndexedDbPersister(store, DB_NAME)

/** Fires after `loadFightHistory()` resolves and after every `saveFight()`. */
export const fightHistoryEvents = new EventTarget()

function notify() {
	fightHistoryEvents.dispatchEvent(new Event('change'))
}

/** Loads once — call explicitly, no autosave and no top-level await. */
export async function loadFightHistory(): Promise<void> {
	await persister.load()
	// Fights logged under a stale event shape can't be read back safely — drop them.
	for (const id of store.getRowIds(TABLE)) {
		if (store.getCell(TABLE, id, 'schema') !== COMBATLOG_SCHEMA) store.delRow(TABLE, id)
	}
	notify()
}

export async function saveFight(f: Omit<StoredFight, 'id' | 'timestamp'>): Promise<void> {
	const id = String(Date.now())
	store.setRow(TABLE, id, {
		schema: COMBATLOG_SCHEMA,
		timestamp: Date.now(),
		outcome: f.outcome,
		duration: f.duration,
		events: JSON.stringify(f.events),
		units: JSON.stringify(f.units),
		...(f.location ? {location: JSON.stringify(f.location)} : {}),
	})
	evictOldest()
	await persister.save()
	notify()
}

/** Read optional metadata without making pre-location rows invalid. */
function readLocation(id: string): FightLocation | undefined {
	const raw = store.getCell(TABLE, id, 'location')
	if (typeof raw !== 'string') return undefined
	try {
		const value: unknown = JSON.parse(raw)
		if (!value || typeof value !== 'object') return undefined
		const candidate = value as Record<string, unknown>
		if (
			typeof candidate.dungeonId !== 'string' ||
			typeof candidate.roomId !== 'string' ||
			typeof candidate.roomNumber !== 'number' ||
			!Number.isInteger(candidate.roomNumber) ||
			candidate.roomNumber < 1
		)
			return undefined
		return {
			dungeonId: candidate.dungeonId as FightLocation['dungeonId'],
			roomId: candidate.roomId,
			roomNumber: candidate.roomNumber,
		}
	} catch {
		return undefined
	}
}

/** Keeps only the newest `MAX_FIGHTS` rows. */
function evictOldest() {
	const ids = store.getRowIds(TABLE)
	if (ids.length <= MAX_FIGHTS) return
	const sorted = ids
		.map((id) => ({id, timestamp: store.getCell(TABLE, id, 'timestamp') as number}))
		.sort((a, b) => b.timestamp - a.timestamp)
	for (const {id} of sorted.slice(MAX_FIGHTS)) store.delRow(TABLE, id)
}

export function listFights(): StoredFightMeta[] {
	return store
		.getRowIds(TABLE)
		.map((id) => {
			const location = readLocation(id)
			return {
				id,
				timestamp: store.getCell(TABLE, id, 'timestamp') as number,
				outcome: store.getCell(TABLE, id, 'outcome') as Outcome,
				duration: store.getCell(TABLE, id, 'duration') as number,
				...(location ? {location} : {}),
			}
		})
		.sort((a, b) => b.timestamp - a.timestamp)
}

/**
 * Which fight the panels are looking at — a stored fight, or `undefined` for the live one.
 * Lives here rather than in any one panel so the Fight report and the Combat log viewer always
 * agree on what a scrub or a seek refers to. Cached on selection: `getFight` parses the whole
 * event log back out of the store, too much to repeat on every render.
 */
let viewed: StoredFight | undefined

export function viewFight(id: string | null): void {
	viewed = id ? getFight(id) : undefined
	notify()
}

export function viewedFight(): StoredFight | undefined {
	return viewed
}

export function getFight(id: string): StoredFight | undefined {
	if (!store.hasRow(TABLE, id)) return undefined
	const location = readLocation(id)
	return {
		id,
		timestamp: store.getCell(TABLE, id, 'timestamp') as number,
		outcome: store.getCell(TABLE, id, 'outcome') as Outcome,
		duration: store.getCell(TABLE, id, 'duration') as number,
		events: JSON.parse(store.getCell(TABLE, id, 'events') as string),
		units: JSON.parse(store.getCell(TABLE, id, 'units') as string),
		...(location ? {location} : {}),
	}
}
