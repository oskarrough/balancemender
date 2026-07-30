import type {Room} from './fight'

/** An ordered sequence of rooms played back to back. */
export interface Dungeon {
	id: string
	name: string
	rooms: Room[]
}

/** The first dungeon: a solo pup, then the tank arrives, a bleed, a healer-hunter, and a frenzy-caller. */
export const WolfWoods: Dungeon = {
	id: 'WolfWoods',
	name: 'Wolf Woods',
	rooms: [
		{name: 'The stray pup', party: [], enemies: ['WolfPup'], grants: ['Heal', 'Smite']},
		// The bleed room — a heal-over-time answers a damage-over-time.
		{name: 'First blood', party: ['Tank'], enemies: ['Snapjaw'], grants: ['Renew']},
		// The ambush room — a fast heal answers a burst.
		{name: 'The skulker', party: ['Tank'], enemies: ['TinyWolf', 'Skulker'], grants: ['FlashHeal']},
		// Three enemies — the multi-dot room.
		{name: 'The howling', party: ['Tank'], enemies: ['WolfShaman', 'Howler', 'TinyWolf'], grants: ['Wither']},
		// The boss kit: pre-shield the telegraphed arrow, big heal for the long fight.
		{name: 'Nakroth the Destroyer', party: ['Tank'], enemies: ['Nakroth'], grants: ['Shield', 'GreaterHeal']},
	],
}

/** Every dungeon, by id. */
export const dungeonRegistry: Record<string, Dungeon> = {WolfWoods}
