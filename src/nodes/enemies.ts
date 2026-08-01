import {Unit} from './unit'
import {FACTION} from './types'
import {Targeting, prefer} from './targeting'
import {NastyArrow, HeavyBlow, Nip, SavageBite, Pounce, Worry, Ambush, Rile} from './attack'
import {Lick} from './spells'
import {
	NastyArrowCadence,
	HeavyBlowCadence,
	LickCadence,
	NipCadence,
	SavageBiteCadence,
	PounceCadence,
	WorryCadence,
	AmbushCadence,
	RileCadence,
} from './cadence'

export class Haruk extends Unit {
	static stamina = 500
	static intellect = 0
	static strength = 25
	static agility = 8
	static spirit = 0
	static faction = FACTION.ENEMY
	static boss = true
	name = 'Haruk'
	abilities = {HeavyBlow, NastyArrow}
	targeting = new Targeting(this, prefer.tankFirst)
	heavyBlowCadence = new HeavyBlowCadence(this)
	nastyArrowCadence = new NastyArrowCadence(this)
}

export class Runt extends Unit {
	static stamina = 240
	static intellect = 0
	static strength = 10
	static agility = 20
	static spirit = 0
	static faction = FACTION.ENEMY
	name = 'Runt'
	image = '/assets/generated/characters/runt.png'
	abilities = {SavageBite, Nip}
	// A fifth of its picks bite someone at random — a wolf, not a soldier (#42).
	targeting = new Targeting(this, prefer.threat(this, 0.2))
	savageBiteCadence = new SavageBiteCadence(this)
	nipCadence = new NipCadence(this)
}

/**
 * The first enemy, and the only one the player meets with no tank in front of them. No bleed — a
 * wound ticking away while you are the one healing it is a later lesson — so all of its pressure
 * arrives through `Pounce`, where the player can see it coming and answer it.
 */
export class Pup extends Unit {
	static stamina = 150
	static intellect = 0
	static strength = 6
	static agility = 20
	static spirit = 0
	static faction = FACTION.ENEMY
	name = 'Pup'
	image = '/assets/generated/characters/runt.png'
	abilities = {Nip, Pounce}
	// A fifth of its picks bite someone at random — a wolf, not a soldier (#42).
	targeting = new Targeting(this, prefer.threat(this, 0.2))
	nipCadence = new NipCadence(this)
	pounceCadence = new PounceCadence(this)
}

/**
 * A wolf that mends the pack instead of biting it, and the one enemy the party is meant to kill
 * first — `Tank` prefers whatever heals. Nothing stops it from carrying attacks too, since each use
 * is handed its own target and a bite and a mend no longer compete for one slot; it has none yet
 * only because a pack this size does not need more damage in it.
 */
export class Denmother extends Unit {
	static stamina = 180
	static intellect = 20
	static strength = 5
	static agility = 12
	static spirit = 5
	static faction = FACTION.ENEMY
	name = 'Denmother'
	abilities = {Lick}
	targeting = new Targeting(this, prefer.lowestHealth)
	cadence = new LickCadence(this)
}

/** Its bleed is the point — the tank's bar keeps falling after the hit. */
export class Snapjaw extends Unit {
	static stamina = 260
	static intellect = 0
	static strength = 16
	static agility = 15
	static spirit = 0
	static faction = FACTION.ENEMY
	name = 'Snapjaw'
	image = '/assets/generated/characters/runt.png'
	abilities = {Nip, Worry}
	targeting = new Targeting(this, prefer.threat(this, 0.2))
	nipCadence = new NipCadence(this)
	worryCadence = new WorryCadence(this)
}

/** It hunts whoever heals — the player — past any tank. */
export class Skulker extends Unit {
	static stamina = 130
	static intellect = 0
	static strength = 10
	static agility = 25
	static spirit = 0
	static faction = FACTION.ENEMY
	name = 'Skulker'
	image = '/assets/generated/characters/runt.png'
	abilities = {Nip, Ambush}
	targeting = new Targeting(this, prefer.healerFirst)
	nipCadence = new NipCadence(this)
	ambushCadence = new AmbushCadence(this)
}

/** Goads a packmate into a frenzy; the buff is why it dies first or second. */
export class Howler extends Unit {
	static stamina = 170
	static intellect = 20
	static strength = 8
	static agility = 12
	static spirit = 0
	static faction = FACTION.ENEMY
	name = 'Howler'
	image = '/assets/generated/characters/runt.png'
	abilities = {Nip, Rile}
	targeting = new Targeting(this, prefer.atRandom())
	nipCadence = new NipCadence(this)
	rileCadence = new RileCadence(this)
}
