import {Unit} from './unit'
import {ShieldBash, Sling} from './attack'
import {ShieldBashCadence, SlingCadence} from './cadence'
import {FACTION} from './types'
import {Targeting, prefer} from './targeting'

export class Tank extends Unit {
	static stamina = 300
	static intellect = 0
	static strength = 20
	static agility = 5
	static spirit = 0
	static faction = FACTION.PARTY
	abilities = {ShieldBash}
	targeting = new Targeting(this, prefer.healerFirst)
	shieldBashCadence = new ShieldBashCadence(this)
	name = 'Oak'
	image = '/assets/generated/characters/tank.png'
}

/** The herder who came back. All damage, no self-defense — keeping them alive is the point of them. */
export class Wren extends Unit {
	static stamina = 140
	static intellect = 0
	static strength = 26
	static agility = 15
	static spirit = 0
	static faction = FACTION.PARTY
	abilities = {Sling}
	targeting = new Targeting(this, prefer.lowestHealth)
	slingCadence = new SlingCadence(this)
	name = 'Wren'
	image = '/assets/generated/characters/wren.png'
}
