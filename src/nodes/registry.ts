import {Heal, FlashHeal, GreaterHeal, Renew} from './spells'
import {TinyWolf, Nakroth} from './enemies'
import {SmallAttack, MediumAttack, HugeAttack, TankAttack} from './damage-effect'

export const spellRegistry = {
	Heal,
	'Flash Heal': FlashHeal,
	'Greater Heal': GreaterHeal,
	Renew,
} as const

export const enemyRegistry = {
	TinyWolf,
	Nakroth,
} as const

export const attackRegistry = {
	SmallAttack,
	MediumAttack,
	HugeAttack,
	TankAttack,
} as const

export type SpellId = keyof typeof spellRegistry
export type EnemyId = keyof typeof enemyRegistry
export type AttackId = keyof typeof attackRegistry
