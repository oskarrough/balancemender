import {Heal, FlashHeal, GreaterHeal, Renew, PowerWordShield, Mend} from './spells'
import {QuickStab, HeavyBlow, SavageBite, NastyArrow, ShieldBash} from './attack'

/** Every one-shot ability, keyed by stable id. Display names are labels only. */
export const abilityRegistry = {
	Heal,
	FlashHeal,
	GreaterHeal,
	Renew,
	PowerWordShield,
	Mend,
	QuickStab,
	HeavyBlow,
	SavageBite,
	NastyArrow,
	ShieldBash,
} as const

/** The player's action bar subset. Units own collections; the global registry is only a catalog. */
export const playerAbilities = {Heal, FlashHeal, GreaterHeal, Renew, PowerWordShield} as const

export type AbilityId = keyof typeof abilityRegistry
export type PlayerAbilityId = keyof typeof playerAbilities
