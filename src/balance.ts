import {Heal, FlashHeal, GreaterHeal, Renew} from './nodes/spells'
import {SmallAttack, MediumAttack, HugeAttack, TankAttack} from './nodes/damage-effect'
import {unitRegistry} from './nodes/unit-registry'

export const SPELL_KEYS = ['cost', 'heal', 'castTime'] as const
export const ATTACK_KEYS = ['minDamage', 'maxDamage', 'interval', 'delay'] as const
export const UNIT_KEYS = ['maxHealth', 'maxMana'] as const

export type SpellKey = (typeof SPELL_KEYS)[number]
export type AttackKey = (typeof ATTACK_KEYS)[number]
export type UnitKey = (typeof UNIT_KEYS)[number]

type NumberDict = Record<string, number>

type SpellClass = {cost: number; heal: number; castTime: number}
type AttackClass = {minDamage: number; maxDamage: number; interval: number; delay: number}
type UnitClass = {maxHealth: number; maxMana?: number}

export const spellClasses: Record<string, SpellClass> = {
	Heal,
	'Flash Heal': FlashHeal,
	'Greater Heal': GreaterHeal,
	Renew,
}

export const attackClasses: Record<string, AttackClass> = {
	SmallAttack,
	MediumAttack,
	HugeAttack,
	TankAttack,
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
	units: snapshot(unitClasses as Record<string, NumberDict>, UNIT_KEYS),
}

export const balance = structuredClone(defaults)

function writeBack(
	classes: Record<string, NumberDict>,
	state: Record<string, Partial<NumberDict>>,
	name: string,
	key: string,
	value: number,
) {
	const cls = classes[name]
	if (!cls || !(key in cls)) return false
	cls[key] = value
	state[name][key] = value
	return true
}

export function setSpellValue(name: string, key: SpellKey, value: number) {
	return writeBack(spellClasses as Record<string, NumberDict>, balance.spells, name, key, value)
}
export function setAttackValue(name: string, key: AttackKey, value: number) {
	return writeBack(attackClasses as Record<string, NumberDict>, balance.attacks, name, key, value)
}
export function setUnitValue(name: string, key: UnitKey, value: number) {
	return writeBack(unitClasses as Record<string, NumberDict>, balance.units, name, key, value)
}

export function resetBalance() {
	for (const [name, def] of Object.entries(defaults.spells)) {
		for (const k of SPELL_KEYS) {
			const v = def[k]
			if (v !== undefined) setSpellValue(name, k, v)
		}
	}
	for (const [name, def] of Object.entries(defaults.attacks)) {
		for (const k of ATTACK_KEYS) {
			const v = def[k]
			if (v !== undefined) setAttackValue(name, k, v)
		}
	}
	for (const [name, def] of Object.entries(defaults.units)) {
		for (const k of UNIT_KEYS) {
			const v = def[k]
			if (v !== undefined) setUnitValue(name, k, v)
		}
	}
}
