import {Node} from 'vroum'
import {Health, HEALTH_EVENTS} from './health'
import {Mana} from './mana'
import {Encounter} from './encounter'
import {DoT} from './dot'
import {HOT} from './hot'
import {createId} from '../utils'
import {Faction, FACTION} from './types'

export type CharacterEffect = HOT | DoT
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

	name = ''
	image = ''
	health: Health
	mana?: Mana
	effects = new Set<CharacterEffect>()
	faction: Faction = FACTION.ENEMY
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
		console.log(`${this.constructor.name} is dead`)
		this.disconnect()
	}

	damage(amount: number) {
		return this.health.damage(amount)
	}
}
