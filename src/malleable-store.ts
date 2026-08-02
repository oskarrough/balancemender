import {emptyMalleable, MALLEABLE_SCHEMA_VERSION, type MalleableComposition} from './malleable'
import {unitRegistry, type UnitId} from './nodes/unit-registry'

export const MALLEABLE_STORAGE_KEY = 'balancemender-malleable-v1'

interface MalleableStorage {
	getItem(key: string): string | null
	setItem(key: string, value: string): void
}

const memory = new Map<string, string>()
const memoryStorage: MalleableStorage = {
	getItem: (key) => memory.get(key) ?? null,
	setItem: (key, value) => memory.set(key, value),
}

function storage(): MalleableStorage {
	try {
		if (typeof globalThis.localStorage !== 'undefined') return globalThis.localStorage
	} catch {
		// A blocked browser store should cost persistence, not the sandbox itself.
	}
	return memoryStorage
}

function unitIds(value: unknown): UnitId[] {
	if (!Array.isArray(value)) return []
	return value.filter((unit): unit is UnitId => typeof unit === 'string' && unit !== 'Player' && unit in unitRegistry)
}

function clean(value: unknown): MalleableComposition {
	if (typeof value !== 'object' || value === null) return emptyMalleable()
	const candidate = value as Record<string, unknown>
	if (candidate.version !== MALLEABLE_SCHEMA_VERSION) return emptyMalleable()
	return {
		version: MALLEABLE_SCHEMA_VERSION,
		party: unitIds(candidate.party),
		enemies: unitIds(candidate.enemies),
	}
}

/** Read and validate the browser save, falling back to an empty room in Node or on corrupt data. */
export function loadMalleable(): MalleableComposition {
	let raw: string | null
	try {
		raw = storage().getItem(MALLEABLE_STORAGE_KEY) ?? memoryStorage.getItem(MALLEABLE_STORAGE_KEY)
	} catch {
		raw = memoryStorage.getItem(MALLEABLE_STORAGE_KEY)
	}
	try {
		return raw ? clean(JSON.parse(raw)) : emptyMalleable()
	} catch {
		return emptyMalleable()
	}
}

/** Best-effort autosave. A blocked or full store falls back to this page's memory. */
export function saveMalleable(composition: MalleableComposition): void {
	const value = JSON.stringify(clean(composition))
	memoryStorage.setItem(MALLEABLE_STORAGE_KEY, value)
	try {
		storage().setItem(MALLEABLE_STORAGE_KEY, value)
	} catch {
		// Memory still keeps the room usable for this page.
	}
}
