import {Patch, Mend, Renew, Shield, Lance, Nettle, Steep, Lick} from './spells'
import {
	Nip,
	HeavyBlow,
	SavageBite,
	NastyArrow,
	ShieldBash,
	Sling,
	Pounce,
	Worry,
	Ambush,
	Rile,
	BellSwing,
	Toll,
	Trample,
	Spore,
	Waft,
	Groundfall,
} from './attack'

/** Every one-shot ability, keyed by stable id. Display names are labels only. */
export const abilityRegistry = {
	Patch,
	Mend,
	Renew,
	Shield,
	Lance,
	Nettle,
	Steep,
	Lick,
	Nip,
	HeavyBlow,
	SavageBite,
	NastyArrow,
	ShieldBash,
	Sling,
	Pounce,
	Worry,
	Ambush,
	Rile,
	BellSwing,
	Toll,
	Trample,
	Spore,
	Waft,
	Groundfall,
} as const

/** The player's action bar subset. Units own collections; the global registry is only a catalog. */
export const playerAbilities = {Patch, Mend, Renew, Shield, Lance, Nettle, Steep} as const

export type AbilityId = keyof typeof abilityRegistry
export type PlayerAbilityId = keyof typeof playerAbilities
