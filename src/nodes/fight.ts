import {Node} from '../vroum'
import {Player} from './player'
import {unitRegistry, UnitId} from './unit-registry'
import {FACTION} from './types'
import type {GameLoop} from './game-loop'
import type {Unit} from './unit'
import type {PlayerAbilityId} from './registry'

/**
 * The plan for one authored fight: who fights, plus how the scene is dressed. The id is the
 * stable key for a room; `name` is display text and may change without changing its history.
 *
 * A bare simulation or test can use `RoomInput` when it has no authored dungeon identity.
 * The dungeon just orders authored rooms — see `src/nodes/dungeon.ts`.
 */
export interface Room {
	/** Stable authored key. Never use `name` as the room's identity. */
	id: string
	/** Allies besides the player, who is always added. */
	party?: UnitId[]
	enemies?: UnitId[]
	name?: string
	/** Id of the scene painting shown behind the fight, faded so the UI stays readable. */
	scene?: string
	/** Spells the player learns on walking in; only dungeon runs read it. */
	grants?: PlayerAbilityId[]
}

/** Input accepted for one-off rooms and terminal simulations without dungeon context. */
export type RoomInput = Omit<Room, 'id'> & {id?: string}

/**
 * A scene is one place painted twice — wide and tall — so a narrow screen gets an authored view
 * rather than a crop. A room names the pair and the files follow from the id, which is what lets a
 * missing counterpart fail loudly in `registry.test.ts` instead of quietly showing nothing.
 */
export function scenePaths(scene: string) {
	const base = `/assets/generated/explorations/${scene}`
	return {landscape: `${base}.png`, portrait: `${base}-portrait.png`}
}

/** The room a fresh boot starts from. */
export const DEMO_ROOM: Room = {id: 'demo-room', party: ['Tank'], enemies: ['Runt']}

/**
 * Owns the party + enemies, built from a `Room`.
 *
 * Everything that adds a unit — boot, the dev console, the Balance Lab, a simulation,
 * a test — goes through `spawn()`. There is deliberately no second way to do it.
 *
 * `player` is the one fixed role in a fight. Other party roles are expressed through unit classes
 * and targeting preferences, so a room may contain any number of them.
 */
export class Fight extends Node {
	party: Unit[] = []
	enemies: Unit[] = []
	player!: Player

	constructor(
		public parent: GameLoop,
		public room: RoomInput = DEMO_ROOM,
	) {
		super(parent)
		for (const id of room.party ?? []) this.spawn(id)
		this.player = this.spawn('Player') as Player
		this.player.selectedTarget = this.player
		for (const id of room.enemies ?? []) this.spawn(id)
	}

	/** Everyone in the fight, both sides. The dead included — see `onDeath`. */
	get units(): Unit[] {
		return [...this.party, ...this.enemies]
	}

	/**
	 * Add a unit to the fight. The class's own `faction` decides which side it joins,
	 * so callers never pick the array themselves.
	 */
	spawn(id: UnitId): Unit {
		const Klass = unitRegistry[id]
		if (!Klass) {
			throw new Error(`Unknown unit: "${id}". Known: ${Object.keys(unitRegistry).join(', ')}`)
		}
		const unit = new Klass(this) as Unit
		unit.unitId = id
		if (unit.faction === FACTION.PARTY) {
			this.party.push(unit)
			// A party unit joining an existing fight enters every enemy's table at zero.
			for (const enemy of this.enemies) enemy.threat?.set(unit, 0)
		} else {
			this.enemies.push(unit)
		}
		this.renumber()
		return unit
	}

	/** Remove a unit by id. Returns false if nothing matched. */
	remove(id: string): boolean {
		const unit = this.units.find((candidate) => candidate.id === id)
		if (!unit) return false
		unit.disconnect()
		this.party = this.party.filter((c) => c !== unit)
		this.enemies = this.enemies.filter((c) => c !== unit)
		this.renumber()
		return true
	}

	/**
	 * A unit's health reached zero. The one death path — a `Unit` hands over here instead
	 * of tearing itself off the tree.
	 *
	 * The dead are not removed: `party` and `enemies` are who *joined*, which is what the fight
	 * report, the re-simulate button and a future resurrect all need. Who is still standing is
	 * `unit.alive`.
	 *
	 * So death is not removal, it is stopping. Tasks on a unit already skip themselves while
	 * `alive` is false; what is cancelled here is the rest — its auras, a cast in progress. Nothing
	 * has to clear its target, because no target is stored on it. Staying connected is also what
	 * lets a corpse resume when it is healed.
	 */
	onDeath(unit: Unit) {
		for (const aura of unit.auras) aura.disconnect()
		unit.currentAbility?.disconnect()
		unit.gcd?.disconnect()
	}

	/**
	 * Two wolves both called "Runt" make an unreadable report, so number them.
	 * Runs after every spawn/remove, which is why it works off `baseName` — renaming
	 * an already-renamed unit would otherwise give you "Runt 1 2".
	 */
	private renumber() {
		const groups = new Map<string, Unit[]>()
		for (const unit of this.units) {
			const base = (unit.baseName ??= unit.name)
			groups.set(base, [...(groups.get(base) ?? []), unit])
		}

		for (const [base, group] of groups) {
			group.forEach((unit, index) => (unit.name = group.length > 1 ? `${base} ${index + 1}` : base))
		}
	}

	/** Defeat is nobody left standing, not an empty array — the dead stay in it. */
	isPartyDefeated() {
		return !this.party.some((unit) => unit.alive)
	}

	isEnemiesDefeated() {
		return !this.enemies.some((unit) => unit.alive)
	}
}
