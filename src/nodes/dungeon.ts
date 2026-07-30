import type {Room} from './fight'

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
		{name: 'The stray pup', party: [], enemies: ['WolfPup']},
		{name: 'Backup arrives', party: ['Tank'], enemies: ['TinyWolf']},
		{name: 'Two wolves', party: ['Tank'], enemies: ['TinyWolf', 'TinyWolf']},
		{name: 'The shaman', party: ['Tank'], enemies: ['TinyWolf', 'WolfShaman']},
		{name: 'Nakroth the Destroyer', party: ['Tank'], enemies: ['Nakroth']},
	],
}

/** Every dungeon, by id. */
export const dungeonRegistry: Record<string, Dungeon> = {WolfWoods}
