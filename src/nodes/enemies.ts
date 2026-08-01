import {Unit} from './unit'
import {FACTION} from './types'
import {Targeting, prefer} from './targeting'
import {NastyArrow, HeavyBlow, Nip, SavageBite, Pounce, Worry, Ambush, Rile, Toll, Trample} from './attack'
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
	TollCadence,
	TrampleCadence,
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

/**
 * Lead beast of a herd nobody came back for, still wearing its bell. Heavy, slow and bulky: it is
 * the tank's problem and nobody else's, and the room around it is cheap bodies.
 *
 * `Trample` is why it is here. The Rust's signature is a wind-up you answer rather than a number you
 * outheal, and the bellwether states that in the plainest terms available — a shield fits inside the
 * cast, and the tank's bar says so if you did not put one up. `HeavyBlow` swings between the
 * trample beats so the healer never gets a free gap; it has no cast time, so it lands mid-wind-up.
 *
 * A real animal wearing a real bell, met before a bell with no animal in it (see Roha).
 *
 * Bulk is the dial that makes the room a fight rather than a checklist: the trample teaches by
 * repetition, and a party that gained Wren (#76) kills twice as fast as the one this was first
 * sized against. The room only punishes Patch spam because it lasts long enough to drain a pool.
 */
export class Bellwether extends Unit {
	static stamina = 600
	static intellect = 0
	static strength = 20
	static agility = 4
	static spirit = 0
	static faction = FACTION.ENEMY
	name = 'Bellwether'
	abilities = {HeavyBlow, Trample}
	targeting = new Targeting(this, prefer.tankFirst)
	heavyBlowCadence = new HeavyBlowCadence(this)
	trampleCadence = new TrampleCadence(this)
}

/**
 * A carrion bird that drops on whoever is worst off — `prefer.lowestHealth`, which no other enemy
 * uses. Its axis is neither threat nor the healer: it is the ratio, so leaving anybody sitting low
 * is what makes the next stoop land on them. Heal the tank up and the kite comes for the healer
 * instead; there is no answer that is not "keep everyone level".
 *
 * `Ambush` rather than an invention of its own — Skulker's leap is the same shape, and the two
 * differ in the only place that matters here, which is who they pick. Fast and fragile: the party
 * can kill it quickly, and the fight asks whether they choose to — the stoop is heavier than the
 * skulker's precisely so that ignoring the bird costs more than killing it, and the bird still
 * falls to four sling stones.
 */
export class Kite extends Unit {
	static stamina = 110
	static intellect = 0
	static strength = 18
	static agility = 30
	static spirit = 0
	static faction = FACTION.ENEMY
	name = 'Kite'
	abilities = {Nip, Ambush}
	targeting = new Targeting(this, prefer.lowestHealth)
	nipCadence = new NipCadence(this)
	ambushCadence = new AmbushCadence(this)
}

/**
 * A husk-shelled beetle, and a cheap body before it is a creature. It dies to two sling stones and
 * carries plain threat with none of a wolf's mischief — it chews whoever has earned its attention
 * and never thinks about it again. In a room this full that is regularly the healer rather than the
 * tank, whose bash names one beetle at a time while the rest sit adding up the healing they can see.
 *
 * It exists so a Rust room can hold four or five units without becoming lethal: bodies are the
 * dungeon's difficulty curve, and this is the body. Its bite is what a body costs to leave alive —
 * one is a nuisance, three chewing the healer is the reason the room cannot be spammed through.
 */
export class Chafer extends Unit {
	static stamina = 70
	static intellect = 0
	static strength = 14
	static agility = 6
	static spirit = 0
	static faction = FACTION.ENEMY
	name = 'Chafer'
	abilities = {Nip}
	targeting = new Targeting(this, prefer.threat(this))
	nipCadence = new NipCadence(this)
}

/**
 * The bell that has been ringing since the waystation sign, on stilt legs, wearing its own head.
 * Not a boss in Haruk's sense — no epithet, and nobody in the shire has a word for her.
 *
 * `Toll` is her whole kit — she has no teeth to give her a second ability with. She swings the bell
 * at whoever is squared up in front of her, so the wound lands on the tank and the healer answers
 * it the ordinary way; what reaches the healer is the sound, which cuts whatever they were casting.
 * That split is the room: pressure to answer, and a beat you have to answer it between.
 *
 * Wren made the original 480-stamina fight short enough for an idle healer to win every seed.
 * With Toll's final pressure, 480 now kills idle but lets both healing bots keep everyone standing;
 * 680 gives the interaction enough cycles to show. In 200 seeds ordinary triage loses Oak in 39
 * and wipes once, while Steep keeps the whole party standing in all 200. More bulk only lengthened
 * the same result, so the interaction is tuned through Toll rather than another stamina bump.
 */
export class Roha extends Unit {
	static stamina = 680
	static intellect = 40
	static strength = 0
	static agility = 5
	static spirit = 0
	static faction = FACTION.ENEMY
	name = 'Roha'
	abilities = {Toll}
	targeting = new Targeting(this, prefer.tankFirst)
	tollCadence = new TollCadence(this)
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
