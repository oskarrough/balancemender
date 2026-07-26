import {Heal, FlashHeal, GreaterHeal, Renew} from './spells'
import {SmallAttack, MediumAttack, WolfBite, HugeAttack, TankAttack} from './damage-effect'

// Units live in `./unit-registry` — see the note there about the import cycle through player.ts.

export const spellRegistry = {
	Heal,
	'Flash Heal': FlashHeal,
	'Greater Heal': GreaterHeal,
	Renew,
} as const

export const attackRegistry = {
	SmallAttack,
	MediumAttack,
	WolfBite,
	HugeAttack,
	TankAttack,
} as const

export type SpellId = keyof typeof spellRegistry
export type AttackId = keyof typeof attackRegistry
