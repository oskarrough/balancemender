import {Unit} from './unit'
import {FACTION} from './types'
import {Targeting, prefer} from './targeting'
import {NastyArrow, HeavyBlow, QuickStab, SavageBite} from './attack'
import {Mend} from './spells'
import {NastyArrowCadence, HeavyBlowCadence, MendCadence, QuickStabCadence, SavageBiteCadence} from './cadence'

export class Nakroth extends Unit {
	static stamina = 500
	static intellect = 0
	static strength = 25
	static agility = 8
	static spirit = 0
	static faction = FACTION.ENEMY
	name = 'Nakroth the Destroyer'
	abilities = {HeavyBlow, NastyArrow}
	targeting = new Targeting(this, prefer.tankFirst)
	heavyBlowCadence = new HeavyBlowCadence(this)
	nastyArrowCadence = new NastyArrowCadence(this)
}

export class TinyWolf extends Unit {
	static stamina = 240
	static intellect = 0
	static strength = 10
	static agility = 20
	static spirit = 0
	static faction = FACTION.ENEMY
	name = 'Tiny wolf'
	image = '/assets/generated/characters/tiny-wolf.png'
	abilities = {SavageBite, QuickStab}
	targeting = new Targeting(this, prefer.threat(this))
	savageBiteCadence = new SavageBiteCadence(this)
	quickStabCadence = new QuickStabCadence(this)
}

/**
 * A wolf that mends the pack instead of biting it, and the one enemy the party is meant to kill
 * first — `Tank` prefers whatever heals. Nothing stops it from carrying attacks too, since each use
 * is handed its own target and a bite and a mend no longer compete for one slot; it has none yet
 * only because a pack this size does not need more damage in it.
 */
export class WolfShaman extends Unit {
	static stamina = 180
	static intellect = 20
	static strength = 5
	static agility = 12
	static spirit = 5
	static faction = FACTION.ENEMY
	name = 'Wolf shaman'
	abilities = {Mend}
	targeting = new Targeting(this, prefer.lowestHealth)
	cadence = new MendCadence(this)
}
