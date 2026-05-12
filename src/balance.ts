import {Heal, FlashHeal, GreaterHeal, Renew} from './nodes/spells'
import {TinyWolf, Nakroth} from './nodes/enemies'
import {SmallAttack, MediumAttack, HugeAttack, TankAttack} from './nodes/damage-effect'

export const SPELL_KEYS = ['cost', 'heal', 'castTime'] as const
export const ATTACK_KEYS = ['minDamage', 'maxDamage', 'interval', 'delay'] as const
export const UNIT_KEYS = ['maxHealth'] as const

export type SpellKey = (typeof SPELL_KEYS)[number]
export type AttackKey = (typeof ATTACK_KEYS)[number]
export type UnitKey = (typeof UNIT_KEYS)[number]

type SpellClass = {cost: number; heal: number; castTime: number}
type AttackClass = {minDamage: number; maxDamage: number; interval: number; delay: number}
type UnitClass = {maxHealth: number}

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

export const unitClasses: Record<string, UnitClass> = {
	TinyWolf,
	Nakroth,
}

function snapshot<K extends string>(src: Record<string, Record<string, number>>, keys: readonly K[]) {
	const out: Record<string, Record<K, number>> = {}
	for (const [name, cls] of Object.entries(src)) {
		const row = {} as Record<K, number>
		for (const k of keys) row[k] = cls[k]
		out[name] = row
	}
	return out
}

const defaults = {
	spells: snapshot(spellClasses, SPELL_KEYS),
	attacks: snapshot(attackClasses, ATTACK_KEYS),
	units: snapshot(unitClasses, UNIT_KEYS),
}

export const balance = structuredClone(defaults)

function writeBack(
	classes: Record<string, Record<string, number>>,
	state: Record<string, Record<string, number>>,
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
	return writeBack(spellClasses, balance.spells, name, key, value)
}
export function setAttackValue(name: string, key: AttackKey, value: number) {
	return writeBack(attackClasses, balance.attacks, name, key, value)
}
export function setUnitValue(name: string, key: UnitKey, value: number) {
	return writeBack(unitClasses, balance.units, name, key, value)
}

export function resetBalance() {
	for (const [name, def] of Object.entries(defaults.spells)) {
		for (const k of SPELL_KEYS) setSpellValue(name, k, def[k])
	}
	for (const [name, def] of Object.entries(defaults.attacks)) {
		for (const k of ATTACK_KEYS) setAttackValue(name, k, def[k])
	}
	for (const [name, def] of Object.entries(defaults.units)) {
		for (const k of UNIT_KEYS) setUnitValue(name, k, def[k])
	}
}
