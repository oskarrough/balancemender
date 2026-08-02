import type {CombatEventType} from '../combatlog'
import {Ability} from './ability'
import {ApplyAura, AoeAura, AoeDamage, Damage, Interrupt, ManaBurn} from './effects'
import {HealMarkGate, ThreatMark} from './heal-mark'
import {PeriodicAura} from './periodic-aura'
import {StatModifierAura} from './stat-modifier-aura'
import {STAT} from './stats'

export class Nip extends Ability {
	static id = 'Nip'
	static name = 'Nip'
	static tags = ['attack', 'melee'] as const
	static school = 'physical' as const
	static targets = 'enemy' as const
	static sound = 'combat_air_hit'
	static eventType: CombatEventType = 'SWING_DAMAGE'
	static effects = [new Damage(0.3)]
}

export class HeavyBlow extends Ability {
	static id = 'HeavyBlow'
	static name = 'Heavy Blow'
	static tags = ['attack', 'melee'] as const
	static school = 'physical' as const
	static targets = 'enemy' as const
	static sound = 'combat_strong_punch'
	static eventType: CombatEventType = 'SWING_DAMAGE'
	static effects = [new Damage(0.35)]
}

/**
 * The wound a bite leaves. It waits one full interval before its first tick, so refreshing it does
 * not turn half the wound into immediate damage.
 *
 * Declared before the bite that plants it: `static effects` runs when the class is defined.
 */
export class Rend extends PeriodicAura {
	static id = 'Rend'
	static name = 'Rend'
	static harms = true
	static interval = 1000
	static repeat = 4
	static delay = 1000
}

/** The wolf's bite: one immediate hit followed by a short, refreshing wound. */
export class SavageBite extends Ability {
	static id = 'SavageBite'
	static name = 'Savage Bite'
	static tags = ['attack', 'melee'] as const
	static school = 'physical' as const
	static targets = 'enemy' as const
	static sound = 'combat_strong_punch'
	static eventType: CombatEventType = 'SWING_DAMAGE'
	// The bite lands first, and the wound only if it left something alive to bleed. Two outcomes,
	// each with its own size: `effect:SavageBite.damage` and `effect:SavageBite.rend`.
	static effects = [new Damage(0.275), new ApplyAura(Rend, 0.48)]
}

/**
 * The pup's leap. A cast time is the whole point: it puts a bar on the pup's own unit frame, so the
 * hit is one the player watched coming and chose what to do about. Big enough that a leap answered
 * with nothing is most of a Mend thrown away, slow enough that answering it is always possible —
 * the first room's lesson is that a telegraph is an instruction.
 *
 * The size is also the room's only losing state: a player who heals and never fights back has to
 * lose the pup, and with Mend at 60 mana (#71) the leap is the one thing outpacing their regen.
 */
export class Pounce extends Ability {
	static id = 'Pounce'
	static name = 'Pounce'
	static tags = ['attack', 'melee'] as const
	static school = 'physical' as const
	static targets = 'enemy' as const
	static castTime = 1500
	static sound = 'combat_strong_punch'
	static eventType: CombatEventType = 'SWING_DAMAGE'
	static effects = [new Damage(4)]
}

/** Wren's sling: riverbed pebbles aimed deliberately at the lowest-health living enemy. No wind-up, no cast time — a herder's plain aim. */
export class Sling extends Ability {
	static id = 'Sling'
	static name = 'Sling'
	static tags = ['attack', 'ranged'] as const
	static school = 'physical' as const
	static targets = 'enemy' as const
	static sound = 'combat_arrow'
	static eventType: CombatEventType = 'RANGE_DAMAGE'
	static effects = [new Damage(0.45)]
}

/** The calm the smoke leaves behind. Shares the ability's id so the cloud reports as one thing. */
export class SmokeAura extends StatModifierAura {
	static id = 'Smoke'
	static name = 'Smoke'
	static stat = STAT.STRENGTH
	static lifetime = 8000
}

/**
 * Clover's smoker, and the mirror of Gale's Wind: the same party-wide `StatModifierAura` machinery
 * pointed at the other side with the sign flipped. Nothing here moves a health bar — every enemy in
 * the cloud simply swings softer while it hangs.
 *
 * Damage was the first attempt and it scaled with how many enemies were in front of it — strong in
 * a crowd of cheap bodies, a third of a sling against one fat one, which broke The White. A
 * reduction scales with what the enemies were going to hit for instead, so it is worth about the
 * same in every room shape. It also pays the mender directly rather than through the kill: damage
 * that never arrives is a heal never cast, which is the mana the party is actually short of.
 *
 * Clover deals no damage at all now. That is the trade — the fight lasts longer and costs less.
 */
export class Smoke extends Ability {
	static id = 'Smoke'
	static name = 'Smoke'
	static tags = ['spell'] as const
	static school = 'physical' as const
	static targets = 'enemy' as const
	static effects = [new AoeAura(SmokeAura, -0.16)]
}

export class NastyArrow extends Ability {
	static id = 'NastyArrow'
	static name = 'Nasty Arrow'
	static tags = ['attack', 'ranged'] as const
	static school = 'physical' as const
	static targets = 'enemy' as const
	static castTime = 2000
	static sound = 'combat_arrow'
	static eventType: CombatEventType = 'RANGE_DAMAGE'
	static effects = [new Damage(2.8)]
}

export class ShieldBash extends Ability {
	static id = 'ShieldBash'
	static name = 'Shield Bash'
	static tags = ['attack', 'melee'] as const
	static school = 'physical' as const
	static targets = 'enemy' as const
	static threatMultiplier = 5
	static sound = 'combat_sword_hit'
	static eventType: CombatEventType = 'SWING_DAMAGE'
	static effects = [new Damage(0.5)]
}

/**
 * The wound Worry leaves, declared before it: `static effects` runs when the class is defined.
 */
export class Gash extends PeriodicAura {
	static id = 'Gash'
	static name = 'Gash'
	static harms = true
	static interval = 1000
	static repeat = 6
	static delay = 1000
}

/** A bite that gnaws rather than tears — the wound outlasts most of a fight's beats. */
export class Worry extends Ability {
	static id = 'Worry'
	static name = 'Worry'
	static tags = ['attack', 'melee'] as const
	static school = 'physical' as const
	static targets = 'enemy' as const
	static sound = 'combat_strong_punch'
	static eventType: CombatEventType = 'SWING_DAMAGE'
	static effects = [new Damage(0.3), new ApplyAura(Gash, 2.8)]
}

/**
 * A slow, telegraphed leap over the front line at whoever its owner has already picked out. Skulker
 * uses it on the healer and Kite on whoever is worst off — the leap is one shape, and who it lands
 * on is the unit's own preference, not the ability's.
 */
export class Ambush extends Ability {
	static id = 'Ambush'
	static name = 'Ambush'
	static tags = ['attack', 'melee'] as const
	static school = 'physical' as const
	static targets = 'enemy' as const
	static castTime = 2000
	static sound = 'combat_strong_punch'
	static eventType: CombatEventType = 'SWING_DAMAGE'
	static effects = [new Damage(2.5)]
}

/**
 * The bellwether putting its whole weight through whoever is squared up in front of it. The wind-up
 * is the instruction — a barrier fits comfortably inside it, and the hit is big enough that the tank
 * feels the difference. The hung bell rehearses the cut-cast, and Roha teaches the full "answer the
 * wind-up" lesson with sound instead of weight — which is why this one arrives first and only asks
 * for a shield.
 *
 * Sized so one Shield still swallows a whole trample (120 against a 150 barrier): the room was
 * tuned when the party was tank and healer, and Wren joining it (#76) halved how long the bell has
 * to make its point.
 */
export class Trample extends Ability {
	static id = 'Trample'
	static name = 'Trample'
	static tags = ['attack', 'melee'] as const
	static school = 'physical' as const
	static targets = 'enemy' as const
	static castTime = 2000
	static sound = 'combat_strong_punch2'
	static eventType: CombatEventType = 'SWING_DAMAGE'
	static effects = [new Damage(3)]
}

/** The sound going on after the bell stops, declared before the toll that leaves it. */
export class Ringing extends PeriodicAura {
	static id = 'Ringing'
	static name = 'Ringing'
	static harms = true
	static interval = 1000
	static repeat = 5
	static delay = 1000
}

/**
 * A herd animal's hung bell, swung once or twice before Roha. Same wind-up and cut-cast as her Toll —
 * Interrupt plus a lighter ringing — so the rhythm is fair warning rather than a surprise (#84).
 * Toll stays Roha's word.
 */
export class BellSwing extends Ability {
	static id = 'BellSwing'
	static name = 'Bell swing'
	static tags = ['spell'] as const
	static school = 'holy' as const
	static targets = 'enemy' as const
	static castTime = 2500
	static eventType: CombatEventType = 'SPELL_DAMAGE'
	// Near Toll's ringing; gentleness is "twice, then done" rather than a softer hit. With the
	// wether's bulk and two chafers, triage survives the surprise and Steep still reduces drops (#84).
	static effects = [new Interrupt(), new ApplyAura(Ringing, 2)]
}

/**
 * Roha's bell, and the only thing she does. It leaves a ringing in whoever it was swung at, and its
 * sound cuts every cast on that side of the room — the wound is the tank's, the interruption is the
 * healer's. Telegraphed longer than Haruk's arrow because the wind-up is the whole instruction:
 * stop casting before it, start again after. A rhythm you play around, not a number you outheal.
 */
export class Toll extends Ability {
	static id = 'Toll'
	static name = 'Toll'
	static tags = ['spell'] as const
	static school = 'holy' as const
	static targets = 'enemy' as const
	static castTime = 2500
	static eventType: CombatEventType = 'SPELL_DAMAGE'
	// At 2.4, the five-second ringing makes lost Mend casts visible in tank deaths; Steep preserves
	// the party without making the no-healing control viable in 200-seed Rust-room comparisons (#81).
	static effects = [new Interrupt(), new ApplyAura(Ringing, 2.4)]
}

/** A pack buff to strength, declared before the howl that plants it. No modifier of its own — the planting effect sizes it. */
export class Frenzy extends StatModifierAura {
	static id = 'Frenzy'
	static name = 'Frenzy'
	static stat = STAT.STRENGTH
	static lifetime = 8000
}

/** A howl that hands a packmate Frenzy instead of hitting anything itself. */
export class Rile extends Ability {
	static id = 'Rile'
	static name = 'Rile'
	static tags = ['spell'] as const
	static school = 'holy' as const
	static targets = 'ally' as const
	static castTime = 2500
	static effects = [new ApplyAura(Frenzy, 0.12)]
}

/** Exclusive mark that makes Sivi target this ally directly. */
export class Brightest extends ThreatMark {
	static id = 'Brightest'
	static name = 'Brightest'
	static description = 'Sivi targets this ally directly.'
	static exclusive = true
}

/** Healer-side gate. Spore's cooldown is paired with this lifetime for ~90% uptime. */
export class Glow extends HealMarkGate {
	static id = 'Glow'
	static name = 'Glow'
	static description = 'Heals move Brightest to the living ally they land on, even at full health.'
	static lifetime = 9000
	static mark = Brightest
}

/** Puts Glow on the healer so their heals plant Brightest. */
export class Spore extends Ability {
	static id = 'Spore'
	static name = 'Spore'
	static tags = ['spell'] as const
	static school = 'holy' as const
	static targets = 'enemy' as const
	static castTime = 1500
	static cooldown = 10000
	static effects = [new ApplyAura(Glow, 0)]
}

/**
 * The puffball's whole pressure: a slow, wide sigh that lands on every living ally at once, in
 * ticks small enough that no single body carries the fight — the Glow's tempo direction is
 * accumulating, not bursting.
 */
export class Waft extends Ability {
	static id = 'Waft'
	static name = 'Waft'
	static tags = ['attack'] as const
	static school = 'physical' as const
	static targets = 'enemy' as const
	static sound = 'combat_air_hit'
	static eventType: CombatEventType = 'SPELL_DAMAGE'
	static effects = [new AoeDamage(0.25)]
}

/**
 * The guardian's whole weight coming down — same telegraphed shape as Trample and Toll, wide
 * enough to answer, and the room's only threat: nothing else about Orovan is fast.
 */
export class Groundfall extends Ability {
	static id = 'Groundfall'
	static name = 'Groundfall'
	static tags = ['attack', 'melee'] as const
	static school = 'physical' as const
	static targets = 'enemy' as const
	static castTime = 2800
	static sound = 'combat_strong_punch2'
	static eventType: CombatEventType = 'SWING_DAMAGE'
	static effects = [new Damage(4.5)]
}

/**
 * The White's whole pressure: no cast time, no hit, no wound — just the healer's own pool
 * draining, the same way spending on their own cast would. Thin air at a blocked source.
 */
export class Hollow extends Ability {
	static id = 'Hollow'
	static name = 'Hollow'
	static tags = ['spell'] as const
	static school = 'holy' as const
	static targets = 'enemy' as const
	static effects = [new ManaBurn(1.0)]
}

/**
 * The party's shared wind, declared before the ability that plants it. Adds strength while it
 * stands; the planting effect's coefficient is the size, so a retune is `effect:Wind.wind`.
 */
export class WindAura extends StatModifierAura {
	static id = 'Wind'
	static name = 'Wind'
	static stat = STAT.STRENGTH
	static lifetime = 8000
}

/**
 * Gale's whole job — a note that carries to every living party member at once, the wind at their
 * back. A party-wide strength buff on the plain `StatModifierAura` machinery: no party unit
 * carries a buff today, so this is the party's first support. Sized by Gale's own strength like
 * any other physical ability, instant and free, and the cadence that feeds it goes quiet when
 * Gale falls — the wind dies with them. Answers the White's scarcity by ending the fight sooner,
 * never by touching the purse.
 */
export class Wind extends Ability {
	static id = 'Wind'
	static name = 'Wind'
	static tags = ['spell'] as const
	static school = 'physical' as const
	static targets = 'ally' as const
	static effects = [new AoeAura(WindAura, 0.2)]
}
