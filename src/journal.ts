import {abilityRegistry, type AbilityId, type PlayerAbilityId} from './nodes/registry'
import {dungeonOrder, dungeonRegistry, type DungeonId} from './nodes/dungeon'
import type {FightLocation} from './fight-location'

/** The schema version stored in the player's one Journal record. */
export const JOURNAL_SCHEMA_VERSION = 1
export const JOURNAL_STORAGE_KEY = 'balancemender-journal-v1'

type CompletedRooms = Partial<Record<DungeonId, string[]>>

/** The canonical data that is persisted. Derived progression is deliberately absent. */
export interface JournalRecord {
	schemaVersion: typeof JOURNAL_SCHEMA_VERSION
	abilityBar: AbilityId[]
	completedRooms: CompletedRooms
}

export interface DungeonProgression {
	dungeonId: DungeonId
	unlocked: boolean
	completed: boolean
	completedRoomIds: readonly string[]
	completedRoomCount: number
	totalRoomCount: number
	/** The first room to enter, or undefined when the dungeon is complete. */
	firstUnmendedRoomIndex?: number
}

/** The read model used by UI and gameplay. It contains no persistence internals. */
export interface JournalView extends Readonly<JournalRecord> {
	/** Abilities taught by rooms whose victories have been recorded. */
	readonly learnedAbilities: readonly PlayerAbilityId[]
	readonly dungeonProgression: readonly DungeonProgression[]
	readonly allComplete: boolean
}

export interface JournalStorage {
	getItem(key: string): string | null
	setItem(key: string, value: string): void
	removeItem(key: string): void
}

const memory = new Map<string, string>()
const memoryStorage: JournalStorage = {
	getItem: (key) => memory.get(key) ?? null,
	setItem: (key, value) => memory.set(key, value),
	removeItem: (key) => memory.delete(key),
}

function storage(): JournalStorage {
	try {
		if (typeof globalThis.localStorage !== 'undefined') return globalThis.localStorage
	} catch {
		// Access to browser storage can be denied by privacy settings. The in-memory fallback still
		// lets the game run; the next page load simply starts from the default Journal.
	}
	return memoryStorage
}

const journalEvents = new EventTarget()
let record = emptyRecord()
let loaded = false
let operations = Promise.resolve()

function emptyRecord(): JournalRecord {
	return {
		schemaVersion: JOURNAL_SCHEMA_VERSION,
		abilityBar: [],
		completedRooms: {},
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null
}

function uniqueStrings(value: unknown): string[] {
	if (!Array.isArray(value)) return []
	return [...new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0))]
}

function normalize(value: unknown): JournalRecord {
	if (!isRecord(value) || value.schemaVersion !== JOURNAL_SCHEMA_VERSION) return emptyRecord()

	const completedRooms: CompletedRooms = {}
	if (isRecord(value.completedRooms)) {
		for (const dungeonId of dungeonOrder) {
			const roomIds = uniqueStrings(value.completedRooms[dungeonId])
			if (roomIds.length) completedRooms[dungeonId] = roomIds
		}
	}

	const abilityBar = uniqueStrings(value.abilityBar).filter((id): id is AbilityId => id in abilityRegistry)
	return {
		schemaVersion: JOURNAL_SCHEMA_VERSION,
		abilityBar,
		completedRooms,
	}
}

function readStoredRecord(): JournalRecord {
	try {
		const raw = storage().getItem(JOURNAL_STORAGE_KEY)
		if (!raw) return emptyRecord()
		return normalize(JSON.parse(raw))
	} catch {
		return emptyRecord()
	}
}

function persist() {
	try {
		storage().setItem(JOURNAL_STORAGE_KEY, JSON.stringify(record))
	} catch {
		// A full or blocked local store must not stop a fight. The in-memory record remains useful
		// for this session, and a later successful mutation gets another chance to save it.
	}
}

function notify() {
	journalEvents.dispatchEvent(new Event('change'))
}

/** Serialize read/modify/write operations so two victories cannot overwrite one another. */
function enqueue<T>(operation: () => T | PromiseLike<T>): Promise<T> {
	const result = operations.then(operation)
	operations = result.then(
		() => undefined,
		() => undefined,
	)
	return result
}

/** Load the Journal explicitly before rendering progression-dependent UI. */
export function loadJournal(): Promise<void> {
	return enqueue(() => {
		record = readStoredRecord()
		loaded = true
		notify()
	})
}

function ensureLoaded() {
	// Gameplay is normally entered only after main() awaits loadJournal(). Keeping the default here
	// makes node-level callers safe too, without exposing the storage object to them.
	if (!loaded) {
		record = readStoredRecord()
		loaded = true
	}
}

/**
 * Record a victory for a stable dungeon room. Returns false for duplicate or unknown locations.
 * The room is the canonical progression fact; fight history is never consulted.
 */
export function recordVictory(location: Pick<FightLocation, 'dungeonId' | 'roomId'>): Promise<boolean> {
	return enqueue(() => {
		ensureLoaded()
		const dungeon = dungeonRegistry[location.dungeonId]
		if (!dungeon || !dungeon.rooms.some((room) => room.id === location.roomId)) return false

		const completed = new Set(record.completedRooms[location.dungeonId] ?? [])
		if (completed.has(location.roomId)) return false
		completed.add(location.roomId)
		record.completedRooms = {
			...record.completedRooms,
			[location.dungeonId]: [...completed],
		}
		persist()
		notify()
		return true
	})
}

/** Change the ordered loadout against the latest queued Journal state. */
export function updateAbilityBar(
	update: (abilityIds: readonly AbilityId[]) => readonly AbilityId[],
): Promise<readonly AbilityId[]> {
	return enqueue(() => {
		ensureLoaded()
		const abilityBar = uniqueStrings(update([...record.abilityBar])).filter(
			(id): id is AbilityId => id in abilityRegistry,
		)
		const changed =
			abilityBar.length !== record.abilityBar.length || abilityBar.some((id, index) => id !== record.abilityBar[index])
		if (changed) {
			record.abilityBar = abilityBar
			persist()
			notify()
		}
		return [...record.abilityBar]
	})
}

/** Replace the single ordered loadout owned by the Journal. */
export function setAbilityBar(abilityIds: readonly AbilityId[]): Promise<void> {
	return updateAbilityBar(() => abilityIds).then(() => undefined)
}

/** Subscribe without handing callers the mutable persisted record or store. */
export function subscribeJournal(listener: () => void): () => void {
	const onChange = () => listener()
	journalEvents.addEventListener('change', onChange)
	return () => journalEvents.removeEventListener('change', onChange)
}

function deriveProgression(): DungeonProgression[] {
	const progression: DungeonProgression[] = []
	for (const dungeonId of dungeonOrder) {
		const dungeon = dungeonRegistry[dungeonId]
		const completedIds = new Set(record.completedRooms[dungeonId] ?? [])
		const completedRoomIds = dungeon.rooms.filter((room) => completedIds.has(room.id)).map((room) => room.id)
		const firstUnmendedRoomIndex = dungeon.rooms.findIndex((room) => !completedIds.has(room.id))
		const completed = dungeon.rooms.length > 0 && firstUnmendedRoomIndex === -1
		progression.push({
			dungeonId,
			unlocked: progression.every((prior) => prior.completed),
			completed,
			completedRoomIds,
			completedRoomCount: completedRoomIds.length,
			totalRoomCount: dungeon.rooms.length,
			...(firstUnmendedRoomIndex >= 0 ? {firstUnmendedRoomIndex} : {}),
		})
	}
	return progression
}

function deriveAbilities(): PlayerAbilityId[] {
	const learned = new Set<PlayerAbilityId>()
	for (const dungeonId of dungeonOrder) {
		const completed = new Set(record.completedRooms[dungeonId] ?? [])
		for (const room of dungeonRegistry[dungeonId].rooms) {
			if (!completed.has(room.id)) continue
			for (const abilityId of room.grants ?? []) {
				if (abilityId in abilityRegistry) learned.add(abilityId)
			}
		}
	}
	return [...learned]
}

/** Read a fresh view so callers cannot mutate Journal state by changing returned arrays. */
export function readJournal(): JournalView {
	ensureLoaded()
	const dungeonProgression = deriveProgression()
	const completedRooms = Object.fromEntries(
		Object.entries(record.completedRooms).map(([dungeonId, roomIds]) => [dungeonId, [...(roomIds ?? [])]]),
	) as CompletedRooms
	return {
		schemaVersion: record.schemaVersion,
		abilityBar: [...record.abilityBar],
		completedRooms,
		learnedAbilities: deriveAbilities(),
		dungeonProgression,
		allComplete: dungeonProgression.every((progress) => progress.completed),
	}
}

/** The room where a dungeon choice should enter: first unmended, or room zero for replay. */
export function startingRoomIndex(dungeonId: DungeonId): number {
	const progress = readJournal().dungeonProgression.find((candidate) => candidate.dungeonId === dungeonId)
	return progress?.firstUnmendedRoomIndex ?? 0
}

/** Clear the one Journal record. Useful for a new profile and node-level persistence tests. */
export function clearJournal(): Promise<void> {
	return enqueue(() => {
		record = emptyRecord()
		loaded = true
		try {
			storage().removeItem(JOURNAL_STORAGE_KEY)
		} catch {
			// Clearing a blocked store is already best effort.
		}
		notify()
	})
}
