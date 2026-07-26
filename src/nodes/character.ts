import {Node} from 'vroum'
import {Health, HEALTH_EVENTS} from './health'
import {Mana} from './mana'
import type {Encounter} from './encounter'
import type {PeriodicEffect} from './periodic'
import {createId, log} from '../utils'
import {Faction, FACTION} from './types'
import type {UnitId} from './unit-registry'

export type CharacterEffect = PeriodicEffect
export type {Faction} from './types'
export {FACTION} from './types'

/**
 * Base character class. Subclasses declare `static maxHealth = N` and the
 * base constructor wires up the Health node — defining `health` as a field
 * initializer in a subclass would create (and orphan) a second one.
 */
export class Character extends Node {
	readonly id: string
	static maxHealth = 100
	/** Which side this unit fights on. Static so the registry can be read without spawning anyone. */
	static faction: Faction = FACTION.ENEMY

	name = ''
	image = ''
	/** The registry id this unit was spawned from. Survives minification; `constructor.name` does not. */
	unitId?: UnitId
	/** `name` before duplicate numbering, so renumbering stays idempotent. */
	baseName?: string
	health: Health
	mana?: Mana
	effects = new Set<CharacterEffect>()
	faction: Faction = (this.constructor as typeof Character).faction
	currentTarget?: Character

	/**
	 * Still standing. This — not membership of `encounter.party`/`enemies` — is who is in the
	 * fight: the dead stay in those arrays. See `Encounter.onDeath()`.
	 */
	get alive() {
		return this.health.current > 0
	}

	getTarget(): Character | undefined {
		return this.currentTarget?.alive ? this.currentTarget : undefined
	}

	constructor(public parent: Encounter) {
		super(parent)
		this.id = createId()
		this.health = new Health(this, (this.constructor as typeof Character).maxHealth)
		this.health.on(HEALTH_EVENTS.EMPTY, this.onHealthEmpty)
	}

	/**
	 * Dying is the encounter's business, not the unit's. This used to call `this.disconnect()`,
	 * which left the corpse half in and half out: vroum's teardown nulls `parent`, but the unit
	 * stayed in `encounter.party`, so anything that walked that array and reached back up the
	 * tree — `Player.getTarget()` reads `this.parent.tank` — threw from the first death onwards.
	 */
	private onHealthEmpty = () => {
		log(`${this.name} is dead`)
		this.parent.onDeath(this)
	}

	damage(amount: number) {
		return this.health.damage(amount)
	}
}
