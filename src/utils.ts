import {createLogger} from './combatlog'
import {Xid} from 'xid-ts'
import {random} from './rng'

/** Inclusive of both ends. Uses the seeded `random()`, so a fight replays from its seed. */
export function randomIntFromInterval(min: number, max: number) {
	return Math.floor(random() * (max - min + 1) + min)
}

export function roundOne(num: number) {
	return Math.round(num * 10) / 10
}

export function clamp(x: number, lower: number, upper: number) {
	return Math.max(lower, Math.min(x, upper))
}

export function toPercent(value: number, max: number) {
	return Math.round((value / max) * 100)
}

/**
 * Returns a new, random number within -percentage and +percentage of the original.
 * e.g. naturalizeNumber(100, 0.1) returns a number between 90 and 110.
 */
export function naturalizeNumber(num = 0, percentage = 0.05) {
	const min = num + num * percentage
	const max = num - num * percentage
	return randomIntFromInterval(min, max)
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

/** Wall-clock time as HH:MM:SS.sss, for the combat log panel. */
export function formatTimestamp(timestamp: number): string {
	return new Date(timestamp).toISOString().substring(11, 23)
}
