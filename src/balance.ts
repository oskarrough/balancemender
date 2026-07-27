import {Heal, FlashHeal, GreaterHeal, Renew} from './nodes/spells'
import {SmallAttack, MediumAttack, WolfBite, WolfBleed, HugeAttack, TankAttack} from './nodes/damage-effect'
import {Mend} from './nodes/enemies'
import {unitRegistry} from './nodes/unit-registry'
import {CONDITION_THRESHOLDS} from './nodes/types'

export const SPELL_KEYS = ['cost', 'heal', 'castTime', 'cooldown'] as const
export const ATTACK_KEYS = ['minDamage', 'maxDamage', 'interval', 'delay'] as const
export const UNIT_KEYS = ['maxHealth', 'maxMana', 'manaRegen'] as const
/**
 * A periodic effect fits none of the three above: it has no cast and no swing, and `total` is
 * what it lands over its whole life rather than per tick. Effects a spell owns keep their
 * magnitude on the spell instead (see `Renew`), so this category is for the ones nothing casts.
 */
export const EFFECT_KEYS = ['total', 'interval', 'repeat', 'delay'] as const
/**
 * A rule is a number the whole game reads, belonging to no one spell or unit. The other four
 * kinds are class statics copied onto an instance at construction; a rule is read live at the
 * point it is used, so retuning one lands on the fight in progress rather than the next cast.
 */
export const RULE_KEYS = ['injured', 'healthy'] as const

export type SpellKey = (typeof SPELL_KEYS)[number]
export type AttackKey = (typeof ATTACK_KEYS)[number]
export type UnitKey = (typeof UNIT_KEYS)[number]
export type EffectKey = (typeof EFFECT_KEYS)[number]
export type RuleKey = (typeof RULE_KEYS)[number]

type NumberDict = Record<string, number>
type PartialDict = Record<string, number | undefined>

type SpellClass = {cost: number; heal: number; castTime: number; cooldown: number}
type AttackClass = {minDamage: number; maxDamage: number; interval: number; delay: number}
type EffectClass = {total: number; interval: number; repeat: number; delay: number}
type RuleClass = {injured: number; healthy: number}
/** Only the player has a mana pool today, so both mana keys are optional. */
type UnitClass = {maxHealth: number; maxMana?: number; manaRegen?: number}

export const spellClasses: Record<string, SpellClass> = {
	Heal,
	FlashHeal,
	GreaterHeal,
	Renew,
	// Not in `spellRegistry` — that is the player's spellbook. Tunable all the same.
	Mend,
}

export const attackClasses: Record<string, AttackClass> = {
	SmallAttack,
	MediumAttack,
	WolfBite,
	HugeAttack,
	TankAttack,
}

export const effectClasses: Record<string, EffectClass> = {
	Rend: WolfBleed,
}

/**
 * Not a class at all — a plain object the game reads live. It satisfies the same shape the
 * category table wants, which is the whole reason a fifth kind costs nothing here.
 */
export const ruleClasses: Record<string, RuleClass> = {
	Condition: CONDITION_THRESHOLDS,
}

/** Keyed by unit id, so tuning a unit and spawning one name it the same way. */
export const unitClasses: Record<string, UnitClass> = unitRegistry

function snapshot<K extends string>(src: Record<string, NumberDict>, keys: readonly K[]) {
	const out: Record<string, Partial<Record<K, number>>> = {}
	for (const [name, cls] of Object.entries(src)) {
		const row: Partial<Record<K, number>> = {}
		for (const k of keys) {
			if (k in cls) row[k] = cls[k]
		}
		out[name] = row
	}
	return out
}

const defaults = {
	spells: snapshot(spellClasses as Record<string, NumberDict>, SPELL_KEYS),
	attacks: snapshot(attackClasses as Record<string, NumberDict>, ATTACK_KEYS),
	effects: snapshot(effectClasses as Record<string, NumberDict>, EFFECT_KEYS),
	units: snapshot(unitClasses as Record<string, NumberDict>, UNIT_KEYS),
	rules: snapshot(ruleClasses as Record<string, NumberDict>, RULE_KEYS),
}

export const balance = structuredClone(defaults)

export type BalanceKind = 'spell' | 'attack' | 'effect' | 'unit' | 'rule'

interface BalanceCategory {
	keys: readonly string[]
	/** The classes themselves. Writing here is what changes the game. */
	classes: Record<string, NumberDict>
	/** What the Balance Lab reads. */
	state: Record<string, PartialDict>
	defaults: Record<string, PartialDict>
}

/**
 * The four kinds of tunable number, in one table.
 *
 * Everything that tunes reads this: the `tune` action, `resetBalance()`, the dev console, the
 * `--tune` flag. It exists because those all used to hand-list the four kinds, and a hand-listed
 * enumeration drifts — `effect` arrived in the action and the CLI but not in the console, so
 * `Rend` was the one number you could change from a terminal and not from the game.
 */
export const balanceCategories: Record<BalanceKind, BalanceCategory> = {
	spell: {keys: SPELL_KEYS, classes: spellClasses, state: balance.spells, defaults: defaults.spells},
	attack: {keys: ATTACK_KEYS, classes: attackClasses, state: balance.attacks, defaults: defaults.attacks},
	effect: {keys: EFFECT_KEYS, classes: effectClasses, state: balance.effects, defaults: defaults.effects},
	unit: {keys: UNIT_KEYS, classes: unitClasses, state: balance.units, defaults: defaults.units},
	rule: {keys: RULE_KEYS, classes: ruleClasses, state: balance.rules, defaults: defaults.rules},
} as Record<BalanceKind, BalanceCategory>

/** False when the name is unknown or the class has no such field — never a silent no-op. */
export function setBalanceValue(kind: BalanceKind, name: string, key: string, value: number) {
	const {classes, state} = balanceCategories[kind]
	const cls = classes[name]
	if (!cls || !(key in cls)) return false
	cls[key] = value
	state[name][key] = value
	return true
}

export const setSpellValue = (name: string, key: SpellKey, value: number) => setBalanceValue('spell', name, key, value)
export const setAttackValue = (name: string, key: AttackKey, value: number) =>
	setBalanceValue('attack', name, key, value)
export const setEffectValue = (name: string, key: EffectKey, value: number) =>
	setBalanceValue('effect', name, key, value)
export const setUnitValue = (name: string, key: UnitKey, value: number) => setBalanceValue('unit', name, key, value)
export const setRuleValue = (name: string, key: RuleKey, value: number) => setBalanceValue('rule', name, key, value)

export function resetBalance() {
	for (const kind of Object.keys(balanceCategories) as BalanceKind[]) {
		for (const [name, row] of Object.entries(balanceCategories[kind].defaults)) {
			for (const [key, value] of Object.entries(row)) {
				if (value !== undefined) setBalanceValue(kind, name, key, value)
			}
		}
	}
}

/**
 * `effect:Rend.total=-8` — one balance number, named as a string.
 *
 * The format both `--tune` and the dev console take, so a number worth trying from a terminal is
 * reachable from inside the game with the same spelling. It lives here rather than with the
 * simulator because tuning is not simulation, and because the four kinds it validates against are
 * right above it.
 */
export interface Tune {
	kind: BalanceKind
	name: string
	key: string
	value: number
}

/** Split from the outside in, so a name containing a dot or a space would still survive. */
export function parseTune(spec: string): Tune {
	const colon = spec.indexOf(':')
	const equals = spec.lastIndexOf('=')
	if (colon < 1 || equals < colon) {
		throw new Error(`Bad tune "${spec}". Expected kind:Name.key=value, e.g. spell:Heal.cost=40`)
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

/**
 * Applies each in order, throwing on the first one that does not land.
 *
 * Loud on purpose: a tune that silently misses returns a sweep identical to the baseline, which
 * reads as "this dial does nothing" and has cost two investigations a full run already.
 */
export function applyTunes(specs: string[]): Tune[] {
	return specs.map((spec) => {
		const tune = parseTune(spec)
		// The key check above cannot catch this on its own: `maxMana` is a real unit key that a
		// wolf simply has no field for.
		if (!setBalanceValue(tune.kind, tune.name, tune.key, tune.value)) {
			throw new Error(`${tune.kind} "${tune.name}" has no ${tune.key} to tune`)
		}
		return tune
	})
}

export const formatTune = (tune: Tune) => `${tune.kind}:${tune.name}.${tune.key}=${tune.value}`
