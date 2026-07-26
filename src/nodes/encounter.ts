import {Node} from 'vroum'
import {Player} from './player'
import {Tank} from './party-characters'
import {unitRegistry, UnitId} from './unit-registry'
import {FACTION} from './types'
import type {GameLoop} from './game-loop'
import type {Character} from './character'

const alive = (c: {health?: {current: number}}) => !!c.health && c.health.current > 0

/** Who is in a fight. This is the only way to describe one — there are no encounter subclasses. */
export interface Roster {
	/** Allies besides the player, who is always added. */
	party?: UnitId[]
	enemies?: UnitId[]
}

/** The fight you get on a fresh boot. */
export const DEMO_ROSTER: Roster = {party: ['Tank'], enemies: ['TinyWolf']}

/**
 * Owns the party + enemies for a single fight, built from a `Roster`.
 *
 * Everything that adds a unit — boot, the dev console, the Balance Lab, a simulation,
 * a test — goes through `spawn()`. There is deliberately no second way to do it.
 *
 * `player` and `tank` are resolved once and read directly thereafter — the UI hits
 * them every render, so a per-access `find()` was wasteful.
 */
export class Encounter extends Node {
	party: Character[] = []
	enemies: Character[] = []
	player!: Player
	tank!: Tank

	constructor(
		public parent: GameLoop,
		public roster: Roster = DEMO_ROSTER,
	) {
		super(parent)
		this.populate(roster)
		this.player = this.party.find((c) => c instanceof Player) as Player
		this.tank = this.party.find((c) => c instanceof Tank) as Tank
	}

	populate(roster: Roster) {
		for (const id of roster.party ?? []) this.spawn(id)
		const player = this.spawn('Player') as Player
		player.currentTarget = player
		for (const id of roster.enemies ?? []) this.spawn(id)
	}

	/**
	 * Add a unit to the fight. The class's own `faction` decides which side it joins,
	 * so callers never pick the array themselves.
	 */
	spawn(id: UnitId): Character {
		const Klass = unitRegistry[id]
		if (!Klass) {
			throw new Error(`Unknown unit: "${id}". Known: ${Object.keys(unitRegistry).join(', ')}`)
		}
		const unit = new Klass(this) as Character
		unit.unitId = id
		if (unit.faction === FACTION.PARTY) this.party.push(unit)
		else this.enemies.push(unit)
		this.renumber()
		return unit
	}

	/** Remove a unit by id. Returns false if nothing matched. */
	remove(id: string): boolean {
		const unit = [...this.party, ...this.enemies].find((c) => c.id === id)
		if (!unit) return false
		unit.disconnect()
		this.party = this.party.filter((c) => c !== unit)
		this.enemies = this.enemies.filter((c) => c !== unit)
		this.renumber()
		return true
	}

	/**
	 * Two wolves both called "Tiny wolf" make an unreadable report, so number them.
	 * Runs after every spawn/remove, which is why it works off `baseName` — renaming
	 * an already-renamed unit would otherwise give you "Tiny wolf 1 2".
	 */
	private renumber() {
		const units = [...this.party, ...this.enemies]
		for (const unit of units) unit.baseName ??= unit.name

		const totals = new Map<string, number>()
		for (const unit of units) totals.set(unit.baseName!, (totals.get(unit.baseName!) ?? 0) + 1)

		const seen = new Map<string, number>()
		for (const unit of units) {
			const base = unit.baseName!
			if ((totals.get(base) ?? 0) < 2) {
				unit.name = base
				continue
			}
			const n = (seen.get(base) ?? 0) + 1
			seen.set(base, n)
			unit.name = `${base} ${n}`
		}
	}

	isPartyDefeated() {
		return !this.party.some(alive)
	}

	isEnemiesDefeated() {
		return !this.enemies.some(alive)
	}
}
