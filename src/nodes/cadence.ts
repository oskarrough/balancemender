import {Task} from '../vroum'
import {applyStatics, log} from '../utils'
import {AbilityUse} from './ability-use'
import {prefer} from './targeting'
import {eligible} from './targets'
import type {Unit} from './unit'

/**
 * Uses one unit-owned ability on a fixed schedule. Cadence owns when, and picks who from its
 * unit's standing preference among the units that ability's own rule allows.
 */
export class Cadence extends Task {
	abilityId: string
	delay = 0
	interval = 0
	repeat = Infinity

	static abilityId = ''
	static delay = 0
	static interval = 0
	static repeat = Infinity

	constructor(
		public parent: Unit,
		abilityId?: string,
	) {
		super(parent)
		applyStatics(this, 'delay', 'interval', 'repeat')
		this.abilityId = abilityId ?? (this.constructor as typeof Cadence).abilityId
		if (!this.abilityId) throw new Error(`${this.constructor.name} needs an ability id to drive`)
	}

	/** Where a unit with real decisions puts them. By default the schedule is the whole decision. */
	shouldUse() {
		return true
	}

	shouldTick() {
		if (!this.parent.alive) return false
		const AbilityClass = this.parent.abilities[this.abilityId]
		if (!AbilityClass) return true
		return !(AbilityUse.usesCastRules(AbilityClass) && (this.parent.currentAbility || this.parent.gcd))
	}

	tick() {
		if (!this.shouldUse()) return
		const AbilityClass = this.parent.abilities[this.abilityId]

		// Ask for an unknown ability once so useAbility's refusal reaches the log.
		if (!AbilityClass) return this.use()

		const targeting = this.parent.targeting

		// A unit with no preference has nothing to choose with, this beat or any other. Say so:
		// beating forever in silence is how a Cadence on a unit that never got a Targeting — the
		// player, for one — looks exactly like a Cadence that is working.
		if (!targeting) return this.refuse('no targeting to choose a target with')

		// Having nobody eligible right now is the other thing entirely, and not a failure at all.
		// Wait for the next beat rather than spend it on a refusal.
		const target = targeting.pick(AbilityClass.targets)
		if (!target) return

		this.use(target)
	}

	private use(target?: Unit) {
		const result = this.parent.useAbility(this.abilityId, target)
		if (!result.ok) this.refuse(result.error)
	}

	private refuse(reason: string) {
		log(`cadence:${this.parent.name}:${this.abilityId}:${reason}`)
	}
}

export class NipCadence extends Cadence {
	static abilityId = 'Nip'
	static delay = 0
	static interval = 1600
}

export class HeavyBlowCadence extends Cadence {
	static abilityId = 'HeavyBlow'
	static delay = 4000
	static interval = 3800
}

export class SavageBiteCadence extends Cadence {
	static abilityId = 'SavageBite'
	static delay = 4000
	static interval = 3800
}

/** Long enough between leaps that a heal always fits in the gap, and the first one is not a surprise. */
export class PounceCadence extends Cadence {
	static abilityId = 'Pounce'
	static delay = 5000
	static interval = 4500
}

/** Haruk's telegraphed nuke. The interval is the boss's difficulty dial: every 2s shaved is one more wind-up to answer per fight (playtest wanted him meaner than 12s). */
export class NastyArrowCadence extends Cadence {
	static abilityId = 'NastyArrow'
	static delay = 8000
	static interval = 10000
}

export class ShieldBashCadence extends Cadence {
	static abilityId = 'ShieldBash'
	static delay = 0
	static interval = 2400
}

/** Wren's steady loose — no wind-up to wait on, so the interval alone is the dps dial. */
export class SlingCadence extends Cadence {
	static abilityId = 'Sling'
	static delay = 500
	static interval = 1800
}

/** Clover's smoker puff, `Sling` reused at a beekeeper's slower tempo — same shape as `SiviAmbushCadence`. */
export class CloverSlingCadence extends SlingCadence {
	static delay = 1500
	static interval = 3600
}

/**
 * Slow on purpose. At 8s this healed for as much as the tank hit for, to the decimal, so the fight
 * stalled at exactly nobody winning (#51). Half as often puts daylight between the two numbers
 * without shaving `Lick` itself, which stays a heal big enough to be worth racing.
 */
export class LickCadence extends Cadence {
	static abilityId = 'Lick'
	static delay = 4000
	static interval = 16000
}

export class WorryCadence extends Cadence {
	static abilityId = 'Worry'
	static delay = 3000
	static interval = 5000
}

export class AmbushCadence extends Cadence {
	static abilityId = 'Ambush'
	static delay = 6000
	static interval = 8000
}

/** The bellwether's slow beat. Wide enough that a shield is always up in time if the player wants it to be. */
export class TrampleCadence extends Cadence {
	static abilityId = 'Trample'
	static delay = 4000
	static interval = 7000
}

/**
 * Roha's whole clock. A toll starts every five seconds: too tight for repeated Mend casts to slip
 * through untouched, while an interrupted Steep still pays during the next wind-up (#81).
 */
export class TollCadence extends Cadence {
	static abilityId = 'Toll'
	static delay = 3000
	static interval = 5000
}

/**
 * The hung bell's rehearsal of Roha's cut: same wind-up shape, twice, then done. A six-second gap
 * lets both swings land before the wether falls, and stops before the closer's endless beat (#84).
 */
export class BellSwingCadence extends Cadence {
	static abilityId = 'BellSwing'
	static delay = 3000
	static interval = 6000
	static repeat = 2
}

export class RileCadence extends Cadence {
	static abilityId = 'Rile'
	static delay = 5000
	static interval = 12000
}

/**
 * Spore always wants the healer, while its owner's standing preference is threat (Brightest chase).
 * Pick the healer here rather than fighting that preference.
 */
export class SporeCadence extends Cadence {
	static abilityId = 'Spore'
	static delay = 500
	static interval = 10000

	tick() {
		if (!this.shouldUse()) return
		const healer = prefer.healerFirst.prefers(eligible(this.parent, 'enemy'))
		if (!healer) return
		const result = this.parent.useAbility(this.abilityId, healer)
		if (!result.ok) log(`cadence:${this.parent.name}:${this.abilityId}:${result.error}`)
	}
}

/** The puffball's sigh — slow enough that each tick is a chip, not a wound. */
export class WaftCadence extends Cadence {
	static abilityId = 'Waft'
	static delay = 2000
	static interval = 4000
}

/**
 * Asleep in its sap shell until this fires — the delay is the whole "joins late" lesson, borrowed
 * straight from `Cadence.delay` rather than a new dormant-unit mechanism.
 */
export class GrubWakeCadence extends HeavyBlowCadence {
	static delay = 6000
}

/** A grub buried deeper in its shell — cracks open well after its siblings, for a staggered room. */
export class GrubWakeCadenceLate extends HeavyBlowCadence {
	static delay = 13000
}

/** The guardian's slow wind-up. Wide enough that a shield or a dodge always fits. */
export class GroundfallCadence extends Cadence {
	static abilityId = 'Groundfall'
	static delay = 5000
	static interval = 9000
}

/**
 * Sivi's lunge — `Ambush` reused as-is, so the wisp that drifts to whoever holds threat (or
 * `Brightest`) hits like Skulker instead of only nipping. Faster than Skulker's own
 * `AmbushCadence`: at 6s it is the room's real threat, and its target is whoever the mark or the
 * threat table points it at, which is the whole "watch who you heal" lesson (200-seed sim with
 * Tank, Wren and Clover: idle loses "The bright water" nearly every seed, triage still clears it).
 */
export class SiviAmbushCadence extends AmbushCadence {
	static delay = 3000
	static interval = 6000
}

/**
 * Hollow always wants the healer, the same way Spore does — reuses `SporeCadence`'s override
 * rather than fighting a unit's own standing preference (Ringer- and Uvalu-shaped units still
 * want threat or the tank for everything else they carry).
 */
export class HollowCadence extends Cadence {
	static abilityId = 'Hollow'
	static delay = 2000
	static interval = 4000

	tick() {
		if (!this.shouldUse()) return
		const healer = prefer.healerFirst.prefers(eligible(this.parent, 'enemy'))
		if (!healer) return
		const result = this.parent.useAbility(this.abilityId, healer)
		if (!result.ok) log(`cadence:${this.parent.name}:${this.abilityId}:${result.error}`)
	}
}
