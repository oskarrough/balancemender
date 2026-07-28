import {Unit} from './unit'
import {FACTION} from './types'
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

	/**
	 * The frame the player clicked. Player UI state and nothing else: the unit frames highlight it
	 * and the keyboard aims at it, while every other driver picks its own target and never touches
	 * this. Clicking a wolf does not send the tank's next swing anywhere.
	 */
	selectedTarget?: Unit

	/**
	 * Who a keypress would land on right now — what is selected, or the tank while nothing is. The
	 * healer always has a fallback so that a deselected player is not left unable to act.
	 */
	get intendedTarget(): Unit | undefined {
		if (this.selectedTarget?.alive) return this.selectedTarget
		const tank = this.parent.tank
		return tank?.alive ? tank : undefined
	}
}
