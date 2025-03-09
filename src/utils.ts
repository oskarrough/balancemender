import {createLogger} from './combatlog'
export {html, render} from 'uhtml'
import {Xid} from 'xid-ts'

export function randomIntFromInterval(min: number, max: number) {
	return Math.floor(Math.random() * (max - min + 1) + min)
}

/**
 * Returns rounded with one decimal
 */
export function roundOne(num: number) {
	return Math.round(num * 10) / 10
}

/**
 * Makes sure the number x is inside the lower and upper bounds.
 */
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

export const logger = createLogger('info')

// @ts-ignore
export const log = (...args) => logger.info(...args)

/** Generates a random, unique ID with xid */
export function createId() {
	return new Xid().toString()
}
