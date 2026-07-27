import {Heal, FlashHeal, GreaterHeal, Renew} from './spells'
import {SmallAttack, MediumAttack, WolfBite, HugeAttack, TankAttack} from './damage-effect'

// Units live in `./unit-registry` — see the note there about the import cycle through player.ts.

// Keyed by `static id`, like the attacks below and like `unitRegistry` — never by display name.
// A spell's name is what a player reads and nothing more; see `Spell.id`.
export const spellRegistry = {
	Heal,
	FlashHeal,
	GreaterHeal,
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
