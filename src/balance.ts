import {abilityRegistry} from './nodes/registry'
import {cadenceRegistry} from './nodes/cadence'
import {unitRegistry} from './nodes/unit-registry'
import type {Unit} from './nodes/unit'
import {CONDITION_THRESHOLDS} from './nodes/types'
import {STAT_KEYS} from './nodes/stats'
import {ApplyAura, DAMAGE_RULES, type Effect} from './nodes/effects'

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
export const AURA_KEYS = ['interval', 'repeat', 'delay', 'maxStacks', 'pool', 'lifetime'] as const
export const RULE_KEYS = ['injured', 'healthy', 'variance'] as const

export type AbilityKey = (typeof ABILITY_KEYS)[number]
export type EffectKey = (typeof EFFECT_KEYS)[number]
export type CadenceKey = (typeof CADENCE_KEYS)[number]
export type UnitKey = (typeof UNIT_KEYS)[number]
export type AuraKey = (typeof AURA_KEYS)[number]
export type RuleKey = (typeof RULE_KEYS)[number]

type NumberDict = Record<string, number>
type PartialDict = Record<string, number | undefined>
type UnitClass = Record<UnitKey, number>

/**
 * Effect size belongs to the effect that lands it, so that is what a coefficient is
 * tuned on: `effect:SavageBite.rend.coefficient=0.6`. Rows are named for the ability that declares
 * the effect and the effect's own label, and built by walking the registry — a new ability's
 * effects are tunable without a list here to remember to update.
 */
export const effectClasses: Record<string, NumberDict> = {}
for (const [abilityId, AbilityClass] of Object.entries(abilityRegistry)) {
	// A subclass's `static effects` infers its own union of effect classes; the interface is
	// where `id` lives, so read them as what the base declares them to be.
	for (const effect of AbilityClass.effects as readonly Effect[]) {
		if (effect.coefficient === undefined) continue
		// The row name is the effect's own — its label, or the explicit `id` an ability declares
		// when two of its effects would share one. Rows used to be numbered by declaration order,
		// so reordering effects renamed their rows; a collision now fails loudly instead.
		const alias = `${abilityId}.${effect.id ?? effect.label}`
		if (effectClasses[alias]) {
			throw new Error(`Two effects on ${abilityId} resolve to the same row "${alias}" — give one an explicit id`)
		}
		effectClasses[alias] = effect as unknown as NumberDict
	}
}

/**
 * One row per aura a fight can carry, keyed by aura id. Walked from two places a fight can pick one
 * up: the abilities that plant them, and the units that wear one from their own field initializer
 * (`Grub.wornAuras`) — either way a new aura is tunable without a list here to remember. A row holds
 * what is left once the planting effect owns the size: the timing, and how many copies stack. A worn
 * aura has no planting effect to size it, so its own static — `pool`, say — is the row instead.
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
for (const UnitClass of Object.values(unitRegistry)) {
	for (const AuraClass of (UnitClass as unknown as typeof Unit).wornAuras) {
		// A subclass unit's own aura variant (`GrubDeep`'s `SapShellDeep`) borrows its base's id on
		// purpose, so the two report as one "Sap shell" row. First claim wins the row rather than the
		// last one overwriting it, so the row stays the base class — a static a subclass does not
		// re-declare (`pool`) is read off it anyway through the prototype chain, and one it does
		// (`lifetime`) simply is not reached from this row, same as it was not reachable before.
		if (!(AuraClass.id in auraClasses)) auraClasses[AuraClass.id] = AuraClass as unknown as NumberDict
	}
}
export const ruleClasses: Record<string, NumberDict> = {Condition: CONDITION_THRESHOLDS, Damage: DAMAGE_RULES}

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
	abilities: snapshot(abilityRegistry as unknown as Record<string, NumberDict>, ABILITY_KEYS),
	effects: snapshot(effectClasses, EFFECT_KEYS),
	cadences: snapshot(cadenceRegistry as unknown as Record<string, NumberDict>, CADENCE_KEYS),
	auras: snapshot(auraClasses, AURA_KEYS),
	units: snapshot(unitRegistry as unknown as Record<string, NumberDict>, UNIT_KEYS),
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
		classes: abilityRegistry as unknown as Record<string, NumberDict>,
		state: balance.abilities,
		defaults: defaults.abilities,
	},
	effect: {keys: EFFECT_KEYS, classes: effectClasses, state: balance.effects, defaults: defaults.effects},
	cadence: {
		keys: CADENCE_KEYS,
		classes: cadenceRegistry as unknown as Record<string, NumberDict>,
		state: balance.cadences,
		defaults: defaults.cadences,
	},
	aura: {keys: AURA_KEYS, classes: auraClasses, state: balance.auras, defaults: defaults.auras},
	unit: {
		keys: UNIT_KEYS,
		classes: unitRegistry as unknown as Record<string, UnitClass>,
		state: balance.units,
		defaults: defaults.units,
	},
	rule: {
		keys: RULE_KEYS,
		classes: ruleClasses,
		state: balance.rules,
		defaults: defaults.rules,
	},
} as Record<BalanceKind, BalanceCategory>

/**
 * Kinds whose values below zero are nonsense: a unit stat, a tick count or a threshold. Ability
 * costs, coefficients and cadence timings may legitimately sit at zero, so only the three kinds
 * the Balance Lab already clamps are constrained here.
 */
const MIN_BY_KIND: Partial<Record<BalanceKind, number>> = {unit: 0, aura: 0, rule: 0}

/**
 * The one value check every tuning path passes — the Balance Lab, the console, `--tune`, tests.
 * The UI used to clamp by itself and every other path could write anything; now a value the rule
 * rejects is refused before it mutates anything.
 */
export function validateBalanceValue(kind: BalanceKind, value: number): string | undefined {
	if (!Number.isFinite(value)) return `Balance values must be finite, got ${value}`
	const min = MIN_BY_KIND[kind]
	if (min !== undefined && value < min) return `${kind} values must be at least ${min}, got ${value}`
	return undefined
}

export function setBalanceValue(kind: BalanceKind, name: string, key: string, value: number) {
	const {classes, state} = balanceCategories[kind]
	const cls = classes[name]
	if (!cls || !(key in cls)) return false
	// Same gate as the action boundary: a value the rule rejects mutates nothing.
	if (validateBalanceValue(kind, value)) return false
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
	// Parse and validate the whole batch before applying any of it, so a failing spec leaves
	// nothing half-tuned behind it — a sweep that lists three `--tune` flags either applies
	// all three or applies none.
	const tunes = specs.map((spec) => parseTune(spec))
	for (const tune of tunes) {
		const {classes} = balanceCategories[tune.kind]
		if (!(tune.key in classes[tune.name])) {
			throw new Error(`${tune.kind} "${tune.name}" has no ${tune.key} to tune`)
		}
		const invalid = validateBalanceValue(tune.kind, tune.value)
		if (invalid) throw new Error(`${formatTune(tune)}: ${invalid}`)
	}
	for (const tune of tunes) setBalanceValue(tune.kind, tune.name, tune.key, tune.value)
	return tunes
}

export const formatTune = (tune: Tune) => `${tune.kind}:${tune.name}.${tune.key}=${tune.value}`
