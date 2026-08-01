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
			scene: 'green-stray-pup',
		},
		// The bleed room — a heal-over-time answers a damage-over-time.
		{
			name: 'First blood',
			party: ['Tank'],
			enemies: ['Snapjaw'],
			grants: ['Renew'],
			scene: 'green-first-blood',
		},
		// The ambush room — a fast heal answers a burst.
		{
			name: 'The skulker',
			party: ['Tank'],
			enemies: ['Runt', 'Skulker'],
			grants: ['Patch'],
			scene: 'green-skulker',
		},
		// Three enemies — the multi-dot room.
		{
			name: 'The howling',
			party: ['Tank'],
			enemies: ['Denmother', 'Howler', 'Runt'],
			grants: ['Nettle'],
			scene: 'green-howling',
		},
		// The boss kit: pre-shield the telegraphed arrow.
		{
			name: 'Haruk',
			party: ['Tank'],
			enemies: ['Haruk'],
			grants: ['Shield'],
			scene: 'green-guardian-glade',
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
		// before the hung bell rehearses the cut and Roha makes it necessary (#81, #84).
		{
			name: 'The dry bed',
			party: ['Tank', 'Wren'],
			enemies: ['Bellwether', 'Chafer', 'Chafer', 'Chafer'],
			grants: ['Mend', 'Lance', 'Renew', 'Patch', 'Nettle', 'Shield', 'Steep'],
			scene: 'rust-waystation',
		},
		// Five bodies, and the two kites drop on whoever is worst off — a new axis after the Green's
		// healer-hunting: nobody may be left sitting low, the healer least of all.
		{
			name: 'The long grass',
			party: ['Tank', 'Wren'],
			enemies: ['Chafer', 'Chafer', 'Chafer', 'Kite', 'Kite'],
			scene: 'rust-long-grass',
		},
		// Fair warning before Roha: a wether still wearing its hung bell swings it twice — same
		// cut-cast shape as her Toll, soft enough to survive the first surprise (#84). Timing gets
		// its own beat; the dry bed kept the trample/shield lesson alone.
		{
			name: 'The hung bell',
			party: ['Tank', 'Wren'],
			enemies: ['Wether', 'Chafer', 'Chafer'],
			scene: 'rust-hung-bell',
		},
		// The bell that has been ringing since the waystation sign, answered at last. She fights
		// alone: the Rust is a lonely dungeon and this is its one strange thing (#72).
		{
			name: 'Roha',
			party: ['Tank', 'Wren'],
			enemies: ['Roha'],
			scene: 'rust-roha',
		},
	],
}

/**
 * The third dungeon. Where the Rust is bulk and bodies, the Glow's pressure is a heal-mark: a
 * gate on the healer makes each heal plant an exclusive threat mark on the patient, so
 * `prefer.threat` enemies (the Sivi) drift to whoever was last healed — see
 * [`heal-mark.ts`](./heal-mark.ts) and [combat.md](../../docs/combat.md#threat-is-local-to-each-enemy).
 * Everything else here ticks slowly and accumulates rather than bursts — Muhl's `Waft` and Grub's
 * delayed wake both read that way, in contrast to Orovan's one telegraphed hit closing the
 * dungeon.
 */
export const TheGlow: Dungeon = {
	id: 'TheGlow',
	name: 'The Glow',
	rooms: [
		// Two puffballs, nothing else — Waft's tick lands on the whole party at once, small enough
		// that even an idle healer walks out unhurt. The room is here to be felt, not survived.
		{
			name: 'The drowned trees',
			party: ['Tank', 'Wren'],
			enemies: ['Muhl', 'Muhl'],
			scene: 'glow-drowned-trees',
		},
		// The heal-mark lesson: two Sivi chase whoever Brightest just landed on rather than whoever
		// holds threat the ordinary way, so healing the wrong body at the wrong moment redirects
		// them. Idle loses this one outright (0% in a 200-seed sim); triage clears it every time.
		{
			name: 'The bright water',
			party: ['Tank', 'Wren'],
			enemies: ['Sivi', 'Sivi', 'Muhl'],
			scene: 'glow-bright-water',
		},
		// Three grubs, staggered — two crack open around 6s in, the third waits until 13s, so the
		// room's weight keeps arriving rather than landing all at once. A Sivi keeps the mark lesson
		// live alongside it.
		{
			name: 'The sap shells',
			party: ['Tank', 'Wren'],
			enemies: ['Grub', 'Grub', 'GrubDeep', 'Sivi'],
			scene: 'glow-sap-shells',
		},
		// The dungeon's guardian, alone. Groundfall is the whole lesson: telegraphed long enough to
		// answer, heavy enough that missing it costs the fight — idle wipes every time, triage clears
		// clean (200-seed sim). Boss-scale health, like Haruk and Roha before her.
		{
			name: 'The tender',
			party: ['Tank', 'Wren'],
			enemies: ['Orovan'],
			scene: 'glow-tender',
		},
	],
}

/**
 * The fourth dungeon. Where the Glow is visibility, the White is scarcity: mana does not come back
 * the way it did downstream, and the finale is one long fight out of a closing purse (#89). The
 * Glider's `Hollow` drains the healer's own pool directly — no hit, no wound — while the Ringer
 * carries the bellwether family's telegraphed weight forward into white stone. Tempo is
 * monumental: few rooms, each an event, per [universe.md](../../docs/universe.md#4-the-white-where-the-river-begins).
 *
 * Not yet in `dungeonRegistry`: the scene art doesn't exist on disk yet. Flip the export below
 * once `white-gliders`, `white-ringing-shelf`, `white-first-water-room` and `white-source` each
 * have a landscape and a portrait painting.
 */
export const TheWhite: Dungeon = {
	id: 'TheWhite',
	name: 'The White',
	rooms: [
		// The first taste of mana that doesn't come back. Both bots clear it every seed — the room
		// is here to be felt, the way Muhl's Waft was in the Glow.
		{
			name: 'The gliders',
			party: ['Tank', 'Wren'],
			enemies: ['Glider', 'Glider'],
			scene: 'white-gliders',
		},
		// Crystal-shelled things that ring when struck, a fight scored by its own chimes. Two
		// Ringers carry the Rust's telegraphed weight; the Glider keeps the pool draining alongside
		// it. Idle wipes every seed; triage clears it but ends the fight nearly dry.
		{
			name: 'The ringing shelf',
			party: ['Tank', 'Wren'],
			enemies: ['Ringer', 'Ringer', 'Glider'],
			scene: 'white-ringing-shelf',
		},
		// The terraced pools, the rider close now. Two Gliders keep the drain constant while a
		// single Ringer supplies the telegraph — idle still wipes, triage still clears.
		{
			name: 'The first water',
			party: ['Tank', 'Wren'],
			enemies: ['Glider', 'Glider', 'Ringer'],
			scene: 'white-first-water-room',
		},
		// Uvalu alone, one long fight out of a closing purse — the fight is the dungeon. Meant to be
		// genuinely hard: idle wipes every seed, triage clears roughly four fights in five.
		{
			name: 'The source',
			party: ['Tank', 'Wren'],
			enemies: ['Uvalu'],
			scene: 'white-source',
		},
	],
}

/** Every dungeon, by id. */
export const dungeonRegistry: Record<string, Dungeon> = {TheGreen, TheRust, TheGlow, TheWhite}
