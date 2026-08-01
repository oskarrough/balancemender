import {Heal, Patch, Mend, Renew, Shield, Lance, Nettle, Lick} from './spells'
import {Nip, HeavyBlow, SavageBite, NastyArrow, ShieldBash, Pounce, Worry, Ambush, Rile, Toll, Trample} from './attack'

/** Every one-shot ability, keyed by stable id. Display names are labels only. */
export const abilityRegistry = {
	Heal,
	Patch,
	Mend,
	Renew,
	Shield,
	Lance,
	Nettle,
	Lick,
	Nip,
	HeavyBlow,
	SavageBite,
	NastyArrow,
	ShieldBash,
	Pounce,
	Worry,
	Ambush,
	Rile,
	Toll,
	Trample,
} as const

/** The player's action bar subset. Units own collections; the global registry is only a catalog. */
export const playerAbilities = {Heal, Patch, Mend, Renew, Shield, Lance, Nettle} as const

export type AbilityId = keyof typeof abilityRegistry
export type PlayerAbilityId = keyof typeof playerAbilities
