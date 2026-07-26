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

	getTarget(): Character | undefined {
		if (this.currentTarget && this.currentTarget.health.current > 0) return this.currentTarget
		return undefined
	}

	constructor(public parent: Encounter) {
		super(parent)
		this.id = createId()
		this.health = new Health(this, (this.constructor as typeof Character).maxHealth)
		this.health.on(HEALTH_EVENTS.EMPTY, this.onHealthEmpty)
	}

	private onHealthEmpty = () => {
		log(`${this.constructor.name} is dead`)
		this.disconnect()
	}

	damage(amount: number) {
		return this.health.damage(amount)
	}
}
