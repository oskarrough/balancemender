import {Node} from 'vroum'
import {Health, HEALTH_EVENTS} from './health'
import {Mana} from './mana'
import {GameLoop} from './game-loop'
import {DoT} from './dot'
import {HOT} from './hot'
import {createId} from '../utils'

export type CharacterEffect = HOT | DoT
export type Faction = 'party' | 'enemy'
export const FACTION = {
	PARTY: 'party' as Faction,
	ENEMY: 'enemy' as Faction,
} as const

/**
 * Base character class
 */
export class Character extends Node {
	readonly id: string = ''

	name = ''
	image = ''
	health = new Health(this)
	mana?: Mana
	effects = new Set<CharacterEffect>()
	faction: Faction = FACTION.ENEMY
	currentTarget?: Character

	constructor(public parent: GameLoop) {
		super(parent)
		this.id = createId()
		this.health.on(HEALTH_EVENTS.EMPTY, this.onHealthEmpty)
	}

	private onHealthEmpty = () => {
		console.log(`${this.constructor.name} is dead`)
		this.disconnect()
	}

	damage(amount: number) {
		return this.health.damage(amount)
	}

	// protected getPotentialTargets(): Character[] {
	// 	const targets =
	// 		this.faction === FACTION.PARTY ? this.parent.enemies : this.parent.party
	// 	return targets.filter((target) => target.health.current > 0)
	// }
}
