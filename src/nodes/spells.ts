import {Ability} from './ability'
import {AbilityUse} from './ability-use'
import {ApplyAura, Damage, Heal} from './effects'
import {PeriodicAura} from './periodic-aura'
import {BarrierAura} from './barrier-aura'

/**
 * Magical healing abilities opt into mana, cast timing and the global cooldown independently.
 *
 * The two direct heals are a pair on purpose (#71): Patch is fast and expensive, Mend slow and
 * efficient with a sweet spot to hit. A third one in between was only ever the worse of both.
 */
export class Patch extends Ability {
	static id = 'Patch'
	static name = 'Patch'
	static tags = ['spell', 'healing'] as const
	static school = 'holy' as const
	static targets = 'ally' as const
	static cost = 80
	static castTime = 1000
	static cooldown = 0
	static gcd = true
	static effects = [new Heal(1)]
}

export class Mend extends Ability {
	static id = 'Mend'
	static name = 'Mend'
	static tags = ['spell', 'healing'] as const
	static school = 'holy' as const
	static targets = 'ally' as const
	// Cheaper than Patch on purpose: with the middle heal gone this is the kit's efficient cast,
	// and at 100 the early rooms ran the healer dry — see the sweep in #71.
	static cost = 60
	static castTime = 3000
	static cooldown = 0
	static gcd = true
	static effects = [new Heal(1.45)]
	// Sweet spot experiment (#33): the one line it takes to opt an ability in. A long enough cast
	// to give the default window something to land in; no override needed to try the defaults.
	static sweetSpot = true
}

/** The player's holy ranged attack. Its inherited event type records the hit as spell damage. */
export class Lance extends Ability {
	static id = 'Lance'
	static name = 'Lance'
	static tags = ['spell', 'attack', 'ranged'] as const
	static school = 'holy' as const
	static targets = 'enemy' as const
	static cost = 40
	static castTime = 1500
	static cooldown = 0
	static gcd = true
	static sound = 'combat_arrow'
	static effects = [new Damage(0.2)]
}

/**
 * An aura a spell leaves behind is declared before the spell that plants it: `static effects` runs
 * when the class is defined, so a class named further down the file is not there yet.
 */

/** Shares the cast's id so its ticks report as the same ability. */
class RenewAura extends PeriodicAura {
	static id = 'Renew'
	static name = 'Renew'
	static interval = 2000
	static repeat = 5
}

export class Renew extends Ability {
	static id = 'Renew'
	static name = 'Renew'
	static tags = ['spell', 'healing'] as const
	static school = 'holy' as const
	static targets = 'ally' as const
	static cost = 60
	static castTime = 0
	static cooldown = 0
	static gcd = true
	static sound = 'spell_rejuvenation'
	// The coefficient sizes the whole heal-over-time, tunable as `effect:Renew.renew`.
	static effects = [new ApplyAura(RenewAura, 1.2)]
}

/** Renew's organic mirror: decay over time instead of life over time. Shares the cast's id. */
class NettleAura extends PeriodicAura {
	static id = 'Nettle'
	static name = 'Nettle'
	static harms = true
	static interval = 2000
	static repeat = 6
}

export class Nettle extends Ability {
	static id = 'Nettle'
	static name = 'Nettle'
	static tags = ['spell', 'attack', 'ranged'] as const
	static school = 'holy' as const
	static targets = 'enemy' as const
	static cost = 40
	static castTime = 0
	static cooldown = 0
	static gcd = true
	static effects = [new ApplyAura(NettleAura, 0.3)]
}

/**
 * The brew Steep leaves brewing, and the whole of the twist (#81): a single instalment, timed to
 * land at what would be the cast's own end. Steep's cast time is the one stored duration; this
 * interval forwards to it, so tuning either balance row cannot make cast and payout drift apart.
 */
class SteepAura extends PeriodicAura {
	static id = 'Steep'
	static name = 'Steep'
	static get interval() {
		return Steep.castTime
	}
	static set interval(value: number) {
		Steep.castTime = value
	}
	static repeat = 1
}

/**
 * Set a brew steeping on an ally: a normal cast, sized and costed like one, but the heal it leaves
 * behind is committed the moment the cast begins rather than when it lands. Roha's toll cuts the
 * cast, never the medicine — timing Steep to eat the toll costs only the tempo already spent (#81).
 *
 * Priced a notch below Mend's heal-per-mana so the twist is a trade, not a strict upgrade: worse
 * than Mend whenever nothing interrupts it, and the one cast on the kit an interruption cannot
 * waste.
 */
export class Steep extends Ability {
	static id = 'Steep'
	static name = 'Steep'
	static tags = ['spell', 'healing'] as const
	static school = 'holy' as const
	static targets = 'ally' as const
	static cost = 60
	static castTime = 3000
	static cooldown = 0
	static gcd = true
	static effects = [new ApplyAura(SteepAura, 1.3)]

	/**
	 * Plants the aura and pays the mana at cast start (#81) — you commit the herbs when you set the
	 * brew, else cancelling your own cast (Escape, moving) would make the heal free. No `super.mount()`:
	 * vroum runs the whole prototype chain itself (vroum.md), and calling it again logs the cast twice.
	 */
	mount() {
		AbilityUse.commit(this)
		if (this.hasValidTarget()) for (const effect of this.effects) effect.apply(this.landing)
	}

	/** The brew already started at cast start; a completed cast only signs itself off with a sound. */
	land() {
		if (this.hasValidTarget()) this.playLandingSound()
	}
}

/** Shares the cast's id so its absorbs report as the same ability. */
class ShieldBarrier extends BarrierAura {
	static id = 'Shield'
	static name = 'Shield'
}

export class Shield extends Ability {
	static id = 'Shield'
	static name = 'Shield'
	static tags = ['spell', 'healing'] as const
	static school = 'holy' as const
	static targets = 'ally' as const
	static cost = 60
	static castTime = 0
	static cooldown = 0
	static gcd = true
	// The coefficient is the size of the pool, not healing — nothing here moves a health bar.
	static effects = [new ApplyAura(ShieldBarrier, 1.5)]
}

/** The denmother's own ability. It is registered like every other ability but not owned by the player. */
export class Lick extends Ability {
	static id = 'Lick'
	static name = 'Lick'
	static tags = ['spell', 'healing'] as const
	static school = 'holy' as const
	static targets = 'ally' as const
	static cost = 0
	static castTime = 2500
	static cooldown = 0
	static gcd = true
	static effects = [new Heal(1.6)]
}
