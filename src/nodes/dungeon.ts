import type {Room} from './fight'

/** An ordered sequence of rooms played back to back. */
export interface Dungeon {
	id: string
	name: string
	rooms: Room[]
}

/** The first dungeon: a solo pup, then the tank arrives, a bleed, a healer-hunter, and a frenzy-caller. */
export const TheGreen: Dungeon = {
	id: 'TheGreen',
	name: 'The Green',
	rooms: [
		// Alone, so every point of mana spent healing is one not spent killing: the calm room is
		// where the slow efficient cast belongs, and the only one quiet enough to learn its sweet spot.
		{
			name: 'The stray pup',
			party: [],
			enemies: ['Pup'],
			grants: ['Mend', 'Lance'],
			wallpaper: '/assets/generated/explorations/green-stray-pup.png',
		},
		// The bleed room — a heal-over-time answers a damage-over-time.
		{name: 'First blood', party: ['Tank'], enemies: ['Snapjaw'], grants: ['Renew']},
		// The ambush room — a fast heal answers a burst.
		{name: 'The skulker', party: ['Tank'], enemies: ['Runt', 'Skulker'], grants: ['Patch']},
		// Three enemies — the multi-dot room.
		{name: 'The howling', party: ['Tank'], enemies: ['Denmother', 'Howler', 'Runt'], grants: ['Nettle']},
		// The boss kit: pre-shield the telegraphed arrow.
		{
			name: 'Haruk',
			party: ['Tank'],
			enemies: ['Haruk'],
			grants: ['Shield'],
			wallpaper: '/assets/generated/explorations/green-guardian-glade.png',
		},
	],
}

/**
 * The second dungeon, built one room at a time. The dry country keeps its own animals rather than
 * the Green's wolves at bigger numbers, and its rooms hold more bodies than the Green's ever did —
 * more to keep standing is the difficulty curve here. The full kit from The Green is granted up
 * front because this is a sequel, not another tutorial (#70).
 */
export const TheRust: Dungeon = {
	id: 'TheRust',
	name: 'The Rust',
	rooms: [
		// A bell you can see the animal inside, three cheap bodies around it. The bellwether's trample
		// is a wind-up wide enough to shield through — the whole room, in sim, is the difference
		// between a healer that pre-shields and one that only reacts. Wren falls in here, at the
		// waystation, with a sling and a pocketful of riverbed pebbles — the party's second body (#76).
		// Steep is granted here too, ahead of the full kit, so the trample gives it a first outing
		// before the bell two rooms later makes it necessary (#81).
		{
			name: 'The dry bed',
			party: ['Tank', 'Wren'],
			enemies: ['Bellwether', 'Chafer', 'Chafer', 'Chafer'],
			grants: ['Mend', 'Lance', 'Renew', 'Patch', 'Nettle', 'Shield', 'Steep'],
			wallpaper: '/assets/generated/explorations/rust-waystation.png',
		},
		// Five bodies, and the two kites drop on whoever is worst off — a new axis after the Green's
		// healer-hunting: nobody may be left sitting low, the healer least of all.
		{name: 'The long grass', party: ['Tank', 'Wren'], enemies: ['Chafer', 'Chafer', 'Chafer', 'Kite', 'Kite']},
		// The bell that has been ringing since the waystation sign, answered at last. She fights
		// alone: the Rust is a lonely dungeon and this is its one strange thing (#72).
		{
			name: 'Roha',
			party: ['Tank', 'Wren'],
			enemies: ['Roha'],
			wallpaper: '/assets/generated/explorations/rust-roha.png',
		},
	],
}

/** Every dungeon, by id. */
export const dungeonRegistry: Record<string, Dungeon> = {TheGreen, TheRust}
