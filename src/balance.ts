import {abilityRegistry} from './nodes/registry'
import {
	NastyArrowCadence,
	HeavyBlowCadence,
	LickCadence,
	NipCadence,
	ShieldBashCadence,
	SlingCadence,
	SavageBiteCadence,
	PounceCadence,
	WorryCadence,
	AmbushCadence,
	RileCadence,
	BellSwingCadence,
	TollCadence,
	TrampleCadence,
} from './nodes/cadence'
import {unitRegistry} from './nodes/unit-registry'
import {CONDITION_THRESHOLDS} from './nodes/types'
import {STAT_KEYS} from './nodes/stats'
import {ApplyAura, DAMAGE_RULES} from './nodes/effects'

export const ABILITY_KEYS = [
	'cost',
	'castTime',
	'cooldown',
	'threatMultiplier',
	'sweetSpotWindow',
	'sweetSpotBonus',
] as const
export const EFFECT_KEYS = ['coefficient'] as const
export const CADENCE_KEYS = ['delay', 'interval'] as const
export const UNIT_KEYS = STAT_KEYS
export const AURA_KEYS = ['interval', 'repeat', 'delay', 'maxStacks'] as const
export const RULE_KEYS = ['injured', 'healthy', 'variance'] as const

export type AbilityKey = (typeof ABILITY_KEYS)[number]
export type EffectKey = (typeof EFFECT_KEYS)[number]
export type CadenceKey = (typeof CADENCE_KEYS)[number]
export type UnitKey = (typeof UNIT_KEYS)[number]
export type AuraKey = (typeof AURA_KEYS)[number]
export type RuleKey = (typeof RULE_KEYS)[number]

type NumberDict = Record<string, number>
type PartialDict = Record<string, number | undefined>
type CadenceClass = {delay: number; interval: number}
type UnitClass = Record<UnitKey, number>

/** One tunable surface for every ability; absent keys remain absent rather than becoming zero rules. */
export const abilityClasses = abilityRegistry

/**
 * Effect size belongs to the effect that lands it, so that is what a coefficient is
 * tuned on: `effect:SavageBite.rend.coefficient=0.6`. Rows are named for the ability that declares
 * the effect and the effect's own label, and built by walking the registry — a new ability's
 * effects are tunable without a list here to remember to update.
 */
export const effectClasses: Record<string, NumberDict> = {}
for (const [abilityId, AbilityClass] of Object.entries(abilityRegistry)) {
	const labels: Record<string, number> = {}
	for (const effect of AbilityClass.effects) {
		if (effect.coefficient === undefined) continue
		// Two of a kind on one ability still get one row each, in the order they land.
		const seen = (labels[effect.label] = (labels[effect.label] ?? 0) + 1)
		const label = seen > 1 ? `${effect.label}${seen}` : effect.label
		effectClasses[`${abilityId}.${label}`] = effect as unknown as NumberDict
	}
}

export const cadenceClasses: Record<string, CadenceClass> = {
	NipCadence,
	HeavyBlowCadence,
	SavageBiteCadence,
	NastyArrowCadence,
	ShieldBashCadence,
	SlingCadence,
	LickCadence,
	PounceCadence,
	WorryCadence,
	AmbushCadence,
	RileCadence,
	BellSwingCadence,
	TollCadence,
	TrampleCadence,
}

/**
 * One row per aura a fight can carry, keyed by aura id and walked out of the abilities that plant
 * them — a new spell's aura is tunable without a list here to remember. A row holds what is left
 * once the planting effect owns the size: the timing, and how many copies stack.
 *
 * Its own namespace, so an aura that borrows its ability's id keeps its own row: `aura:Renew` is
 * the heal-over-time, `ability:Renew` the cast that plants it.
 */
export const auraClasses: Record<string, NumberDict> = {}
for (const AbilityClass of Object.values(abilityRegistry)) {
	for (const effect of AbilityClass.effects) {
		if (effect instanceof ApplyAura) auraClasses[effect.auraClass.id] = effect.auraClass as unknown as NumberDict
	}
}
export const ruleClasses: Record<string, NumberDict> = {Condition: CONDITION_THRESHOLDS, Damage: DAMAGE_RULES}
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
	effects: snapshot(effectClasses, EFFECT_KEYS),
	cadences: snapshot(cadenceClasses as Record<string, NumberDict>, CADENCE_KEYS),
	auras: snapshot(auraClasses, AURA_KEYS),
	units: snapshot(unitClasses as Record<string, NumberDict>, UNIT_KEYS),
	rules: snapshot(ruleClasses, RULE_KEYS),
}

export const balance = structuredClone(defaults)
export type BalanceKind = 'ability' | 'effect' | 'cadence' | 'aura' | 'unit' | 'rule'

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
	effect: {keys: EFFECT_KEYS, classes: effectClasses, state: balance.effects, defaults: defaults.effects},
	cadence: {keys: CADENCE_KEYS, classes: cadenceClasses, state: balance.cadences, defaults: defaults.cadences},
	aura: {keys: AURA_KEYS, classes: auraClasses, state: balance.auras, defaults: defaults.auras},
	unit: {keys: UNIT_KEYS, classes: unitClasses, state: balance.units, defaults: defaults.units},
	rule: {
		keys: RULE_KEYS,
		classes: ruleClasses,
		state: balance.rules,
		defaults: defaults.rules,
	},
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
		throw new Error(`Bad tune "${spec}". Expected kind:Name.key=value, e.g. ability:Mend.cost=40`)
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
