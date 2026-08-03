import {createStore} from 'tinybase'
import {createIndexedDbPersister} from 'tinybase/persisters/persister-indexed-db'
import {COMBATLOG_SCHEMA, type CombatLogEvent} from './combatlog'
import type {FightLocation} from './fight-location'
import type {Outcome, UnitInfo} from './sim/report'
import {serialQueue} from './utils'

const DB_NAME = 'balancemender-fight-history-v1'
const TABLE = 'fights'

export const MAX_FIGHTS = 40

/** The lightweight saved-fight metadata used by pickers and Journal views. */
export interface SavedFight {
	readonly id: string
	readonly timestamp: number
	readonly outcome: Outcome
	readonly duration: number
	readonly location?: FightLocation
}

/** The full, lazily parsed payload for one saved fight. */
export interface SavedFightDetail extends SavedFight {
	readonly events: readonly CombatLogEvent[]
	readonly units: readonly UnitInfo[]
}

export type FightSelection =
	| {readonly status: 'live'}
	| {readonly status: 'ready'; readonly fight: SavedFightDetail}
	| {readonly status: 'not-found'; readonly id: string}

export function fightSelectionKey(selection: FightSelection): string {
	if (selection.status === 'live') return 'live'
	if (selection.status === 'ready') return `ready:${selection.fight.id}`
	return `not-found:${selection.id}`
}

export interface FightHistoryView {
	readonly status: 'loading' | 'ready'
	readonly savedFights: readonly SavedFight[]
}

const store = createStore()
const persister = createIndexedDbPersister(store, DB_NAME, undefined, (error) => {
	throw error
})

let status: FightHistoryView['status'] = 'loading'
let selection: FightSelection = {status: 'live'}
/** Keeps persistence mutations ordered so two writes cannot overwrite one another. */
const enqueue = serialQueue()

/** Fires when loading, rows, or the shared panel selection changes. */
export const fightHistoryEvents = new EventTarget()

function notify() {
	fightHistoryEvents.dispatchEvent(new Event('change'))
}

/** TinyBase creates its stores on save, but a first load must work on an empty database. */
async function ensurePersisterDatabase(): Promise<void> {
	const hasNoObjectStores = await new Promise<boolean>((resolve, reject) => {
		let settled = false
		const request = indexedDB.open(DB_NAME)
		const rejectOnce = (error: unknown) => {
			if (settled) return
			settled = true
			reject(error)
		}
		request.onerror = () => rejectOnce(request.error)
		request.onblocked = () => rejectOnce(new Error(`IndexedDB initialization blocked for ${DB_NAME}`))
		request.onsuccess = () => {
			const database = request.result
			if (settled) {
				database.close()
				return
			}
			settled = true
			const hasNoObjectStores = database.objectStoreNames.length === 0
			database.close()
			resolve(hasNoObjectStores)
		}
	})
	if (hasNoObjectStores) await persister.save()
}

/** Load explicitly; the Journal may render progression while this remains `loading`. */
export function loadFightHistory(): Promise<void> {
	return enqueue(async () => {
		status = 'loading'
		notify()
		try {
			await ensurePersisterDatabase()
			await persister.load()
			let changed = false
			for (const id of store.getRowIds(TABLE)) {
				if (store.getCell(TABLE, id, 'schema') !== COMBATLOG_SCHEMA) {
					store.delRow(TABLE, id)
					changed = true
				}
			}
			changed = evictOldest() || changed
			if (changed) await persister.save()
		} finally {
			checkSelection(true)
			status = 'ready'
			notify()
		}
	})
}

export function saveFight(fight: Omit<SavedFightDetail, 'id' | 'timestamp'>): Promise<void> {
	return enqueue(async () => {
		const timestamp = Date.now()
		const id = uniqueId(timestamp)
		store.setRow(TABLE, id, {
			schema: COMBATLOG_SCHEMA,
			timestamp,
			outcome: fight.outcome,
			duration: fight.duration,
			events: JSON.stringify(fight.events),
			units: JSON.stringify(fight.units),
			...(fight.location ? {location: JSON.stringify(fight.location)} : {}),
		})
		evictOldest()
		checkSelection()
		try {
			await persister.save()
		} finally {
			notify()
		}
	})
}

/** Date-based ids remain readable while same-millisecond saves get a stable suffix. */
function uniqueId(timestamp: number): string {
	const base = String(timestamp)
	if (!store.hasRow(TABLE, base)) return base
	let suffix = 1
	while (store.hasRow(TABLE, `${base}-${String(suffix).padStart(6, '0')}`)) suffix++
	return `${base}-${String(suffix).padStart(6, '0')}`
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

/** Keep only the newest rows; a suffixed id breaks same-millisecond timestamp ties. */
function evictOldest(): boolean {
	const ids = store.getRowIds(TABLE)
	if (ids.length <= MAX_FIGHTS) return false
	const sorted = ids
		.map((id) => ({id, timestamp: store.getCell(TABLE, id, 'timestamp') as number}))
		.sort((a, b) => b.timestamp - a.timestamp || b.id.localeCompare(a.id))
	for (const {id} of sorted.slice(MAX_FIGHTS)) store.delRow(TABLE, id)
	return true
}

function readSavedFights(): SavedFight[] {
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
		.sort((a, b) => b.timestamp - a.timestamp || b.id.localeCompare(a.id))
}

/** Read a fresh metadata snapshot. Event and unit payloads stay serialized. */
export function readFightHistory(): FightHistoryView {
	return {status, savedFights: readSavedFights()}
}

/** Parse only the requested row's full event and unit payloads. */
export function readSavedFight(id: string): SavedFightDetail | undefined {
	if (!store.hasRow(TABLE, id)) return undefined
	try {
		const events: unknown = JSON.parse(store.getCell(TABLE, id, 'events') as string)
		const units: unknown = JSON.parse(store.getCell(TABLE, id, 'units') as string)
		if (!Array.isArray(events) || !Array.isArray(units)) return undefined
		const location = readLocation(id)
		return {
			id,
			timestamp: store.getCell(TABLE, id, 'timestamp') as number,
			outcome: store.getCell(TABLE, id, 'outcome') as Outcome,
			duration: store.getCell(TABLE, id, 'duration') as number,
			events: events as CombatLogEvent[],
			units: units as UnitInfo[],
			...(location ? {location} : {}),
		}
	} catch {
		return undefined
	}
}

/** Select one saved row, or explicitly return both panels to the live fight. */
export function viewFight(id: string | null): void {
	if (id === null) selection = {status: 'live'}
	else {
		const fight = readSavedFight(id)
		selection = fight ? {status: 'ready', fight} : {status: 'not-found', id}
	}
	notify()
}

export function viewedFight(): FightSelection {
	return selection
}

function checkSelection(reload = false) {
	if (selection.status === 'live') return
	const id = selection.status === 'ready' ? selection.fight.id : selection.id
	if (!store.hasRow(TABLE, id)) {
		selection = {status: 'not-found', id}
		return
	}
	if (reload) {
		const fight = readSavedFight(id)
		selection = fight ? {status: 'ready', fight} : {status: 'not-found', id}
	}
}

/** Clear saved rows without touching canonical Journal progression. */
export function clearFightHistory(): Promise<void> {
	return enqueue(async () => {
		const selectedId =
			selection.status === 'ready' ? selection.fight.id : selection.status === 'not-found' ? selection.id : null
		store.delTable(TABLE)
		status = 'ready'
		if (selectedId) selection = {status: 'not-found', id: selectedId}
		try {
			await persister.save()
		} finally {
			notify()
		}
	})
}
