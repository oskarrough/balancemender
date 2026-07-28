import {Node} from 'vroum'
import {Player} from './player'
import {Tank} from './party-units'
import {unitRegistry, UnitId} from './unit-registry'
import {FACTION} from './types'
import type {GameLoop} from './game-loop'
import type {Unit} from './unit'

/** Who is in an encounter. This is the only way to describe one — there are no encounter subclasses. */
export interface Roster {
	/** Allies besides the player, who is always added. */
	party?: UnitId[]
	enemies?: UnitId[]
}

/** The roster a fresh boot starts from. */
export const DEMO_ROSTER: Roster = {party: ['Tank'], enemies: ['TinyWolf']}

/**
 * Owns the party + enemies, built from a `Roster`.
 *
 * Everything that adds a unit — boot, the dev console, the Balance Lab, a simulation,
 * a test — goes through `spawn()`. There is deliberately no second way to do it.
 *
 * `player` and `tank` are resolved once and read directly thereafter — the UI hits
 * them every render, so a per-access `find()` was wasteful.
 */
export class Encounter extends Node {
	party: Unit[] = []
	enemies: Unit[] = []
	player!: Player
	tank!: Tank

	constructor(
		public parent: GameLoop,
		public roster: Roster = DEMO_ROSTER,
	) {
		super(parent)
		for (const id of roster.party ?? []) this.spawn(id)
		this.player = this.spawn('Player') as Player
		this.player.selectedTarget = this.player
		for (const id of roster.enemies ?? []) this.spawn(id)
		this.tank = this.party.find((unit) => unit instanceof Tank) as Tank
	}

	/** Everyone in the fight, both sides. The dead included — see `onDeath`. */
	get units(): Unit[] {
		return [...this.party, ...this.enemies]
	}

	/**
	 * Add a unit to the encounter. The class's own `faction` decides which side it joins,
	 * so callers never pick the array themselves.
	 */
	spawn(id: UnitId): Unit {
		const Klass = unitRegistry[id]
		if (!Klass) {
			throw new Error(`Unknown unit: "${id}". Known: ${Object.keys(unitRegistry).join(', ')}`)
		}
		const unit = new Klass(this) as Unit
		unit.unitId = id
		if (unit.faction === FACTION.PARTY) this.party.push(unit)
		else this.enemies.push(unit)
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
	}

	/**
	 * Two wolves both called "Tiny wolf" make an unreadable report, so number them.
	 * Runs after every spawn/remove, which is why it works off `baseName` — renaming
	 * an already-renamed unit would otherwise give you "Tiny wolf 1 2".
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
