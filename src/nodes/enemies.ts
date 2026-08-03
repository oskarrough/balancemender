import {Unit} from './unit'
import {BarrierAura} from './barrier-aura'
import {FACTION} from './types'
import {Targeting, prefer} from './targeting'
import {
	NastyArrow,
	HeavyBlow,
	Nip,
	SavageBite,
	Pounce,
	Worry,
	Ambush,
	Rile,
	BellSwing,
	Toll,
	Trample,
	Spore,
	Brightest,
	Waft,
	Groundfall,
	Hollow,
} from './attack'
import {Lick} from './spells'
import {Cadence, cadenceRegistry} from './cadence'

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
	heavyBlowCadence = new Cadence(this, cadenceRegistry.HeavyBlowCadence)
	nastyArrowCadence = new Cadence(this, cadenceRegistry.NastyArrowCadence)
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
	savageBiteCadence = new Cadence(this, cadenceRegistry.SavageBiteCadence)
	nipCadence = new Cadence(this, cadenceRegistry.NipCadence)
}

/**
 * The first enemy, and the only one the player meets with no tank in front of them. No bleed — a
 * wound ticking away while you are the one healing it is a later lesson — so all of its pressure
 * arrives through `Pounce`, where the player can see it coming and answer it.
 */
export class Pup extends Unit {
	static stamina = 135
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
	nipCadence = new Cadence(this, cadenceRegistry.NipCadence)
	pounceCadence = new Cadence(this, cadenceRegistry.PounceCadence)
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
	cadence = new Cadence(this, cadenceRegistry.LickCadence)
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
	nipCadence = new Cadence(this, cadenceRegistry.NipCadence)
	worryCadence = new Cadence(this, cadenceRegistry.WorryCadence)
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
	nipCadence = new Cadence(this, cadenceRegistry.NipCadence)
	ambushCadence = new Cadence(this, cadenceRegistry.AmbushCadence)
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
	heavyBlowCadence = new Cadence(this, cadenceRegistry.HeavyBlowCadence)
	trampleCadence = new Cadence(this, cadenceRegistry.TrampleCadence)
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
	nipCadence = new Cadence(this, cadenceRegistry.NipCadence)
	ambushCadence = new Cadence(this, cadenceRegistry.AmbushCadence)
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
	nipCadence = new Cadence(this, cadenceRegistry.NipCadence)
}

/**
 * A herd animal still wearing its hung bell — the cousin of the bellwether, not the lead. Soft bulk,
 * a plain nip, and two swings of that bell: the same cut-cast shape as Roha's Toll, gentler and then
 * done (#84). The dry bed already taught the shield; this room is only the rhythm.
 *
 * Tuned over 200 seeds with Wren: triage clears every seed and keeps the whole party in ~187, while
 * Steep keeps all three in all 200 — the same shape as Roha at about a third of her drop rate. Idle
 * wipes. Gentler absolute pressure; Steep still changes the outcome.
 */
export class Wether extends Unit {
	static stamina = 480
	static intellect = 40
	static strength = 16
	static agility = 6
	static spirit = 0
	static faction = FACTION.ENEMY
	name = 'Wether'
	abilities = {Nip, BellSwing}
	targeting = new Targeting(this, prefer.tankFirst)
	nipCadence = new Cadence(this, cadenceRegistry.NipCadence)
	bellSwingCadence = new Cadence(this, cadenceRegistry.BellSwingCadence)
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
	tollCadence = new Cadence(this, cadenceRegistry.TollCadence)
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
	targeting = new Targeting(this, prefer.threat(this, 0.2))
	nipCadence = new Cadence(this, cadenceRegistry.NipCadence)
	rileCadence = new Cadence(this, cadenceRegistry.RileCadence)
}

/**
 * The Glow wisp: paints the Glow gate on the healer (`SporeCadence`), then targets whoever it
 * marked `Brightest`, falling back to ordinary threat. `Ambush` is reused whole — same leap
 * Skulker uses, on its own faster `SiviAmbushCadence` — so the wisp that drifts to the marked ally
 * hits hard, and the mark's redirect carries real risk: 200-seed sim with the full party (Tank,
 * Wren, Clover), `Sivi*2, Muhl` — idle loses nearly every seed, triage still clears every seed.
 * Stamina raised from 140 to hold that shape once Clover's extra body (#88) padded the party's health pool.
 * "Ambush" reads oddly on a wisp's lunge rather than a leap — a naming pass for a director later.
 */
export class Sivi extends Unit {
	static stamina = 200
	static intellect = 0
	static strength = 18
	static agility = 22
	static spirit = 0
	static faction = FACTION.ENEMY
	name = 'Sivi'
	image = '/assets/generated/characters/sivi.png'
	abilities = {Nip, Spore, Ambush}
	targeting = new Targeting(this, prefer.auraFirst(Brightest.id, prefer.threat(this)))
	nipCadence = new Cadence(this, cadenceRegistry.NipCadence)
	sporeCadence = new Cadence(this, cadenceRegistry.SporeCadence)
	ambushCadence = new Cadence(this, cadenceRegistry.SiviAmbushCadence)
}

/**
 * A sighing puffball, all pressure and no aim. `Waft` reaches every living ally at once in small
 * ticks — the Glow's tempo lesson before the mark-and-chase one arrives: a long fight at
 * heal-over-time speed rather than a burst any single Mend answers outright.
 */
export class Muhl extends Unit {
	static stamina = 170
	static intellect = 0
	static strength = 14
	static agility = 6
	static spirit = 0
	static faction = FACTION.ENEMY
	name = 'Muhl'
	image = '/assets/generated/characters/muhl.png'
	abilities = {Waft}
	// Waft hits the whole party regardless of who this settles on; any living ally keeps the cast valid.
	targeting = new Targeting(this, prefer.atRandom())
	waftCadence = new Cadence(this, cadenceRegistry.WaftCadence)
}

/**
 * The sap shell itself, as a barrier the grub wears from the first frame: whatever you spend on a
 * sleeping grub goes into the shell, not the animal. It falls away exactly when the grub cracks
 * open, so `lifetime` comes from the matching wake cadence template.
 *
 * Without it a shell was only a late cadence — the grub fully targetable from t=0 — so the room's
 * stagger was something the party could skip rather than wait out, and one area ability cleared all
 * three before the deep one ever woke. The shell is what makes the sleep cost something.
 */
class SapShell extends BarrierAura {
	static id = 'SapShell'
	static name = 'Sap shell'
	static pool = 40
	static lifetime = cadenceRegistry.GrubWakeCadence.delay
}

class SapShellDeep extends SapShell {
	static lifetime = cadenceRegistry.GrubWakeCadenceLate.delay
}

export class Grub extends Unit {
	static stamina = 130
	static intellect = 0
	static strength = 20
	static agility = 4
	static spirit = 0
	static faction = FACTION.ENEMY
	static wornAuras = [SapShell]
	name = 'Grub'
	image = '/assets/generated/characters/grub.png'
	abilities = {HeavyBlow}
	targeting = new Targeting(this, prefer.threat(this))
	heavyBlowCadence = new Cadence(this, cadenceRegistry.GrubWakeCadence)
	shell = new SapShell(this, this)
}

/** The same grub, buried deeper in its shell — cracks open only once its siblings already have, for a room where all three do not wake together. */
export class GrubDeep extends Grub {
	static wornAuras = [SapShellDeep]
	heavyBlowCadence = new Cadence(this, cadenceRegistry.GrubWakeCadenceLate)
	shell = new SapShellDeep(this, this)
}

/**
 * The dungeon's guardian: tall, slow, and the room's only threat. `Groundfall` is the whole
 * telegraph — long enough to answer, same shape as Trample and Toll — with `HeavyBlow` filling the
 * gap between wind-ups so the healer never gets a completely free beat. Boss-scale health, like
 * Haruk and Roha. Raised from 650 once Clover's extra body (#88) let idle win nearly half its
 * 200-seed sims; back at 700 idle wipes again while triage still clears clean.
 */
export class Orovan extends Unit {
	static stamina = 700
	static intellect = 0
	static strength = 22
	static agility = 4
	static spirit = 0
	static faction = FACTION.ENEMY
	static boss = true
	name = 'Orovan'
	image = '/assets/generated/characters/orovan.png'
	abilities = {HeavyBlow, Groundfall}
	targeting = new Targeting(this, prefer.tankFirst)
	heavyBlowCadence = new Cadence(this, cadenceRegistry.HeavyBlowCadence)
	groundfallCadence = new Cadence(this, cadenceRegistry.GroundfallCadence)
}

/**
 * A silent glider that casts no shadow — the White's whole pressure in one unit. `Hollow` is its
 * only ability: no hit, no wound, just the healer's own pool draining on `HollowCadence`'s slow
 * beat. Sturdy enough to survive a few ticks rather than dying to the party's first swings — the
 * room's lesson is the drain, and a glider that dies before it lands two casts teaches nothing.
 * Stamina raised from 260 once Gale's extra body (#90) pushed both White rooms to idle-wins; at
 * 420 a glider still dies to the party's first focus-fire but drags the fight out long enough for
 * the drain to land. 200-seed sim, "The gliders" (`Glider*2`, full party): both idle and triage
 * win every seed — visible, survivable, the taste rather than the bite.
 */
export class Glider extends Unit {
	static stamina = 420
	static intellect = 16
	static strength = 0
	static agility = 10
	static spirit = 0
	static faction = FACTION.ENEMY
	name = 'Glider'
	image = '/assets/generated/characters/glider.png'
	abilities = {Hollow}
	targeting = new Targeting(this, prefer.healerFirst)
	hollowCadence = new Cadence(this, cadenceRegistry.HollowCadence)
}

/**
 * Crystal-shelled, sturdy and slow — the bellwether family's own kit reused whole: `HeavyBlow`
 * between wind-ups, `Trample` for the telegraph. Nothing new here on purpose; the White's rooms
 * spend their invention on Glider and Uvalu, and a Ringer is the Rust's weight wearing white stone.
 * Stamina raised from 420 when Gale (#90) joined the walk: the fourth body's free damage and the
 * party-wide wind would otherwise let an idle healer's party out-kill "The ringing shelf" — at
 * 560 the ringers outlast the tank, so the room still needs mending.
 */
export class Ringer extends Unit {
	static stamina = 560
	static intellect = 0
	static strength = 15
	static agility = 4
	static spirit = 0
	static faction = FACTION.ENEMY
	name = 'Ringer'
	image = '/assets/generated/characters/ringer.png'
	abilities = {HeavyBlow, Trample}
	targeting = new Targeting(this, prefer.tankFirst)
	heavyBlowCadence = new Cadence(this, cadenceRegistry.HeavyBlowCadence)
	trampleCadence = new Cadence(this, cadenceRegistry.TrampleCadence)
}

/**
 * The source-keeper, alone — the fight is the dungeon. `Groundfall` and `HeavyBlow` carry the same
 * telegraphed-boss shape as Orovan; `Hollow` runs alongside on its own `HollowCadence`, always
 * aimed at the healer regardless of Uvalu's own tank-first preference (the same split Sivi's Spore
 * and Nip already keep). Boss-scale health, and the two pressures — a closing purse and a wind-up
 * to answer — arrive together rather than one after the other. Stamina raised from 900 once
 * Clover's extra body (#88) pushed triage's clear rate to 100%, and again to 1680 when Gale's wind
 * (#90) pushed it straight back: 200-seed sim with Tank, Wren, Clover and Gale — idle wipes every
 * seed, triage clears ~8 in 10. The finale is meant to be genuinely hard rather than a guaranteed
 * clear.
 */
export class Uvalu extends Unit {
	// Raised from 1680 when Clover's smoke replaced her sling: the reduction handed the party enough
	// slack that the finale became a certainty. Stamina is a knife-edge here — the fight is bounded by
	// the purse, not the health bar, so 1850 already drops it to 7%.
	static stamina = 1720
	static intellect = 20
	static strength = 22
	static agility = 4
	static spirit = 0
	static faction = FACTION.ENEMY
	static boss = true
	name = 'Uvalu'
	image = '/assets/generated/characters/uvalu.png'
	abilities = {HeavyBlow, Groundfall, Hollow}
	targeting = new Targeting(this, prefer.tankFirst)
	heavyBlowCadence = new Cadence(this, cadenceRegistry.HeavyBlowCadence)
	groundfallCadence = new Cadence(this, cadenceRegistry.GroundfallCadence)
	hollowCadence = new Cadence(this, cadenceRegistry.HollowCadence)
}
