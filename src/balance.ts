import {abilityRegistry} from './nodes/registry'
import {Rend} from './nodes/attack'
import {
	NastyArrowCadence,
	HeavyBlowCadence,
	MendCadence,
	QuickStabCadence,
	ShieldBashCadence,
	SavageBiteCadence,
} from './nodes/cadence'
import {unitRegistry} from './nodes/unit-registry'
import {CONDITION_THRESHOLDS} from './nodes/types'

export const ABILITY_KEYS = ['cost', 'magnitude', 'castTime', 'cooldown', 'minDamage', 'maxDamage'] as const
export const CADENCE_KEYS = ['delay', 'interval'] as const
export const UNIT_KEYS = ['maxHealth', 'maxMana', 'manaRegen'] as const
export const AURA_KEYS = ['total', 'interval', 'repeat', 'delay'] as const
export const RULE_KEYS = ['injured', 'healthy'] as const

export type AbilityKey = (typeof ABILITY_KEYS)[number]
export type CadenceKey = (typeof CADENCE_KEYS)[number]
export type UnitKey = (typeof UNIT_KEYS)[number]
export type AuraKey = (typeof AURA_KEYS)[number]
export type RuleKey = (typeof RULE_KEYS)[number]

type NumberDict = Record<string, number>
type PartialDict = Record<string, number | undefined>
type CadenceClass = {delay: number; interval: number}
type AuraClass = {total: number; interval: number; repeat: number; delay: number}
type RuleClass = {injured: number; healthy: number}
type UnitClass = {maxHealth: number; maxMana?: number; manaRegen?: number}

/** One tunable surface for every ability; absent keys remain absent rather than becoming zero rules. */
export const abilityClasses = abilityRegistry

export const cadenceClasses: Record<string, CadenceClass> = {
	QuickStabCadence,
	HeavyBlowCadence,
	SavageBiteCadence,
	NastyArrowCadence,
	ShieldBashCadence,
	MendCadence,
}

export const auraClasses: Record<string, AuraClass> = {Rend: Rend}
export const ruleClasses: Record<string, RuleClass> = {Condition: CONDITION_THRESHOLDS}
export const unitClasses: Record<string, UnitClass> = unitRegistry

function snapshot<K extends string>(src: Record<string, NumberDict>, keys: readonly K[]) {
	const out: Record<string, Partial<Record<K, number>>> = {}
	for (const [name, cls] of Object.entries(src)) {
		const row: Partial<Record<K, number>> = {}
		for (const key of keys) if (key in cls) row[key] = cls[key]
		out[name] = row
	}
	return out
}

const defaults = {
	abilities: snapshot(abilityClasses as unknown as Record<string, NumberDict>, ABILITY_KEYS),
	cadences: snapshot(cadenceClasses as Record<string, NumberDict>, CADENCE_KEYS),
	auras: snapshot(auraClasses as Record<string, NumberDict>, AURA_KEYS),
	units: snapshot(unitClasses as Record<string, NumberDict>, UNIT_KEYS),
	rules: snapshot(ruleClasses as Record<string, NumberDict>, RULE_KEYS),
}

export const balance = structuredClone(defaults)
export type BalanceKind = 'ability' | 'cadence' | 'aura' | 'unit' | 'rule'

interface BalanceCategory {
	keys: readonly string[]
	classes: Record<string, NumberDict>
	state: Record<string, PartialDict>
	defaults: Record<string, PartialDict>
}

export const balanceCategories: Record<BalanceKind, BalanceCategory> = {
	ability: {
		keys: ABILITY_KEYS,
		classes: abilityClasses as unknown as Record<string, NumberDict>,
		state: balance.abilities,
		defaults: defaults.abilities,
	},
	cadence: {keys: CADENCE_KEYS, classes: cadenceClasses, state: balance.cadences, defaults: defaults.cadences},
	aura: {keys: AURA_KEYS, classes: auraClasses, state: balance.auras, defaults: defaults.auras},
	unit: {keys: UNIT_KEYS, classes: unitClasses, state: balance.units, defaults: defaults.units},
	rule: {keys: RULE_KEYS, classes: ruleClasses, state: balance.rules, defaults: defaults.rules},
} as Record<BalanceKind, BalanceCategory>

export function setBalanceValue(kind: BalanceKind, name: string, key: string, value: number) {
	const {classes, state} = balanceCategories[kind]
	const cls = classes[name]
	if (!cls || !(key in cls)) return false
	cls[key] = value
	state[name][key] = value
	return true
}

export function resetBalance() {
	for (const kind of Object.keys(balanceCategories) as BalanceKind[]) {
		for (const [name, row] of Object.entries(balanceCategories[kind].defaults)) {
			for (const [key, value] of Object.entries(row)) {
				if (value !== undefined) setBalanceValue(kind, name, key, value)
			}
		}
	}
}

export interface Tune {
	kind: BalanceKind
	name: string
	key: string
	value: number
}

export function parseTune(spec: string): Tune {
	const colon = spec.indexOf(':')
	const equals = spec.lastIndexOf('=')
	if (colon < 1 || equals < colon) {
		throw new Error(`Bad tune "${spec}". Expected kind:Name.key=value, e.g. ability:Heal.cost=40`)
	}

	const kind = spec.slice(0, colon) as BalanceKind
	const target = spec.slice(colon + 1, equals)
	const dot = target.lastIndexOf('.')
	const kinds = Object.keys(balanceCategories)
	if (!kinds.includes(kind)) throw new Error(`Unknown tune kind "${kind}". Known: ${kinds.join(', ')}`)
	if (dot < 1) throw new Error(`Bad tune "${spec}". Expected ${kind}:Name.key=value`)

	const {keys, classes} = balanceCategories[kind]
	const name = target.slice(0, dot)
	const key = target.slice(dot + 1)
	const value = Number(spec.slice(equals + 1))
	const names = Object.keys(classes)

	if (!names.includes(name)) throw new Error(`Unknown ${kind} "${name}". Known: ${names.join(', ')}`)
	if (!keys.includes(key)) throw new Error(`Unknown ${kind} key "${key}". Known: ${keys.join(', ')}`)
	if (!Number.isFinite(value)) throw new Error(`Tune "${spec}" needs a number, got "${spec.slice(equals + 1)}"`)
	return {kind, name, key, value}
}

export function applyTunes(specs: string[]): Tune[] {
	return specs.map((spec) => {
		const tune = parseTune(spec)
		if (!setBalanceValue(tune.kind, tune.name, tune.key, tune.value)) {
			throw new Error(`${tune.kind} "${tune.name}" has no ${tune.key} to tune`)
		}
		return tune
	})
}

export const formatTune = (tune: Tune) => `${tune.kind}:${tune.name}.${tune.key}=${tune.value}`
