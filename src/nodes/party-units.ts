import {Unit} from './unit'
import {ShieldBash} from './attack'
import {ShieldBashCadence} from './cadence'
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
	name = 'Tank'
	image = '/assets/generated/characters/tank.png'
}
