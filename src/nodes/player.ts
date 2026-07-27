import {Unit, FACTION} from './unit'
import {Mana} from './mana'
import {playerAbilities} from './registry'
import type {AbilityClass} from './ability'
import type {Encounter} from './encounter'

export class Player extends Unit {
	static maxHealth = 160
	static maxMana = 600
	static manaRegen = 9
	static faction = FACTION.PARTY
	name = 'Player'
	image = '/assets/generated/characters/player.png'
	mana: Mana
	abilities: Record<string, AbilityClass> = playerAbilities

	constructor(public parent: Encounter) {
		super(parent)
		const stats = this.constructor as typeof Player
		this.mana = new Mana(this, stats.maxMana, stats.manaRegen)
	}

	/** The healer always has a fallback target. Other units use only what their Targeting chose. */
	getTarget() {
		const target = super.getTarget()
		if (target) return target
		const tank = this.parent.tank
		return tank?.health.current > 0 ? tank : undefined
	}
}
