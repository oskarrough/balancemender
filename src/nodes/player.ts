import {Unit} from './unit'
import {FACTION, type Faction} from './types'
import {Mana} from './mana'
import {playerAbilities} from './registry'
import {eligible} from './targets'
import {prefer} from './targeting'
import type {AbilityClass} from './ability'
import type {Fight} from './fight'

export class Player extends Unit {
	static stamina = 160
	static intellect = 40
	static strength = 5
	static agility = 10
	static spirit = 9
	static faction = FACTION.PARTY
	name = 'Player'
	image = '/assets/generated/characters/player.png'
	mana: Mana
	abilities: Record<string, AbilityClass> = playerAbilities

	constructor(
		public parent: Fight,
		faction?: Faction,
	) {
		super(parent, faction)
		this.mana = new Mana(this, this.stats.maxMana, this.stats.manaRegen)
	}

	/**
	 * The frame the player clicked. Player UI state and nothing else: the unit frames highlight it
	 * and the keyboard aims at it, while every other driver picks its own target and never touches
	 * this. Clicking a wolf does not send the tank's next swing anywhere.
	 */
	selectedTarget?: Unit

	/**
	 * Who a keypress would land on right now — what is selected, or the first living ally with tanks
	 * preferred. The healer always has a fallback so that a deselected player is not left unable to
	 * act, without making one tank a special property of the fight.
	 */
	get intendedTarget(): Unit | undefined {
		if (this.selectedTarget?.alive) return this.selectedTarget
		return prefer.tankFirst.prefers(eligible(this, 'ally'))
	}
}
