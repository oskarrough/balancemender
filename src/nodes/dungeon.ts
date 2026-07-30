import type {Roster} from './encounter'

/** One fight in a dungeon: who you face, and how the scene is dressed. */
export interface Room {
	roster: Roster
	name?: string
	/** No renderer yet — see #66. */
	wallpaper?: string
}

/** An ordered sequence of rooms played back to back. */
export interface Dungeon {
	id: string
	name: string
	rooms: Room[]
}

/** The first dungeon: a solo pup, then the tank arrives and the pack grows. */
export const WolfWoods: Dungeon = {
	id: 'WolfWoods',
	name: 'Wolf Woods',
	rooms: [
		{name: 'The stray pup', roster: {party: [], enemies: ['WolfPup']}},
		{name: 'Backup arrives', roster: {party: ['Tank'], enemies: ['TinyWolf']}},
		{name: 'Two wolves', roster: {party: ['Tank'], enemies: ['TinyWolf', 'TinyWolf']}},
		{name: 'The shaman', roster: {party: ['Tank'], enemies: ['TinyWolf', 'WolfShaman']}},
		{name: 'Nakroth the Destroyer', roster: {party: ['Tank'], enemies: ['Nakroth']}},
	],
}

/** Every dungeon, by id. */
export const dungeonRegistry: Record<string, Dungeon> = {WolfWoods}
