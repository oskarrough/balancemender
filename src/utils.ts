import {createLogger} from './combatlog'
import {Xid} from 'xid-ts'

export function roundOne(num: number) {
	return Math.round(num * 10) / 10
}

export function clamp(x: number, lower: number, upper: number) {
	return Math.max(lower, Math.min(x, upper))
}

export function toPercent(value: number, max: number) {
	return Math.round((value / max) * 100)
}

/** No level of its own, so `setLogLevel()` reaches it even when it loads afterwards. */
export const logger = createLogger()

// @ts-ignore
export const log = (...args) => logger.info(...args)

export function createId() {
	return new Xid().toString()
}

/**
 * Copy named static fields from `instance.constructor` onto `instance`.
 * Lets subclasses act as pure data templates while preserving the
 * snapshot-at-construction semantics the balance UI relies on.
 */
export function applyStatics<T extends object, K extends keyof T>(instance: T, ...keys: K[]) {
	const Ctor = instance.constructor as unknown as Record<string, unknown>
	for (const k of keys) {
		const v = Ctor[k as string]
		if (v !== undefined) (instance as Record<string, unknown>)[k as string] = v
	}
}

/** Seconds into the fight, written the way the fight report writes them — `12.4s`. */
export function formatFightTime(ms: number): string {
	return `${(ms / 1000).toFixed(1)}s`
}
