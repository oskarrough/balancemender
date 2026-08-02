import {Unit} from './unit'
import {ShieldBash, Sling, Smoke, Wind} from './attack'
import {GaleSlingCadence, GaleWindCadence, ShieldBashCadence, SlingCadence, SmokeCadence} from './cadence'
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

/**
 * The beekeeper, and the party's answer to a crowd: their smoker puffs over the whole room at once,
 * the only area damage anyone on this side does. Built to be lit as well — the mender keeps the
 * heal-mark on them on purpose so Sivi drift to them instead of squishier bodies. Sturdier than
 * Wren, softer than Oak. Standing calm inside a cloud of stinging things is
 * the trade, so both halves of them are the same job.
 */
export class Clover extends Unit {
	static stamina = 200
	static intellect = 0
	static strength = 15
	static agility = 10
	static spirit = 0
	static faction = FACTION.PARTY
	abilities = {Smoke}
	targeting = new Targeting(this, prefer.lowestHealth)
	smokeCadence = new SmokeCadence(this)
	name = 'Clover'
	image = '/assets/generated/characters/clover.png'
}

/**
 * The messenger who rode ahead since the Rust — the party's last body and first support. Not a
 * fighter: their stones are the party's lightest chip, and their whole job is the party-wide Wind
 * they keep up while they stand. Sturdy enough to have walked the whole river alone, soft enough
 * that keeping them standing under scarcity is exactly the White's question — the wind dies with
 * them, so the mender pays to keep it blowing.
 */
export class Gale extends Unit {
	static stamina = 180
	static intellect = 0
	static strength = 14
	static agility = 10
	static spirit = 0
	static faction = FACTION.PARTY
	abilities = {Sling, Wind}
	targeting = new Targeting(this, prefer.lowestHealth)
	galeSlingCadence = new GaleSlingCadence(this)
	galeWindCadence = new GaleWindCadence(this)
	name = 'Gale'
	image = '/assets/generated/characters/gale.png'
}
