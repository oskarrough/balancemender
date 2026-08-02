import {Task} from '../vroum'
import {log} from '../utils'
import {AbilityUse} from './ability-use'
import type {AbilityId} from './registry'
import {prefer} from './targeting'
import {eligible} from './targets'
import type {Unit} from './unit'

export interface CadenceTemplate {
	abilityId: AbilityId
	delay: number
	interval: number
	repeat?: number
	/** Picks afresh each beat instead of using the unit's standing preference. */
	preference?: 'healerFirst'
}

/**
 * Uses one unit-owned ability on a fixed schedule. Cadence owns when, and picks who from its
 * unit's standing preference among the units that ability's own rule allows.
 */
export class Cadence extends Task {
	abilityId: AbilityId
	delay = 0
	interval = 0
	repeat = Infinity
	private preference?: CadenceTemplate['preference']

	constructor(
		public parent: Unit,
		template: CadenceTemplate,
	) {
		super(parent)
		this.abilityId = template.abilityId
		this.delay = template.delay
		this.interval = template.interval
		this.repeat = template.repeat ?? Infinity
		this.preference = template.preference
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

		if (this.preference) {
			const target = prefer[this.preference].prefers(eligible(this.parent, AbilityClass.targets))
			if (target) this.use(target)
			return
		}

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

/** Stable tuning keys mapped to the templates each new Cadence snapshots. */
export const cadenceRegistry = {
	NipCadence: {abilityId: 'Nip', delay: 0, interval: 1600},
	HeavyBlowCadence: {abilityId: 'HeavyBlow', delay: 4000, interval: 3800},
	SavageBiteCadence: {abilityId: 'SavageBite', delay: 4000, interval: 3800},

	/** Haruk's telegraphed nuke. Every 2s shaved from the interval is one more wind-up to answer per fight. */
	NastyArrowCadence: {abilityId: 'NastyArrow', delay: 8000, interval: 10000},
	ShieldBashCadence: {abilityId: 'ShieldBash', delay: 0, interval: 2400},

	/** Wren's steady loose — no wind-up to wait on, so the interval alone is the dps dial. */
	SlingCadence: {abilityId: 'Sling', delay: 500, interval: 1800},

	/** Clover's smoker, kept at the beekeeper's slower tempo — a cloud drifts out, it does not snap. */
	SmokeCadence: {abilityId: 'Smoke', delay: 1500, interval: 3600},

	/** Slow enough that the heal does not stall the fight at exactly nobody winning (#51). */
	LickCadence: {abilityId: 'Lick', delay: 4000, interval: 16000},

	/** Long enough between leaps that a heal always fits in the gap, and the first one is not a surprise. */
	PounceCadence: {abilityId: 'Pounce', delay: 5000, interval: 4500},
	WorryCadence: {abilityId: 'Worry', delay: 3000, interval: 5000},
	AmbushCadence: {abilityId: 'Ambush', delay: 6000, interval: 8000},
	RileCadence: {abilityId: 'Rile', delay: 5000, interval: 12000},

	/** The hung bell rehearses Roha's cut twice, with enough room for both swings to land. */
	BellSwingCadence: {abilityId: 'BellSwing', delay: 3000, interval: 6000, repeat: 2},

	/** Roha's clock: tight enough that repeated Mend casts cannot slip through untouched. */
	TollCadence: {abilityId: 'Toll', delay: 3000, interval: 5000},

	/** The bellwether's slow beat. Wide enough that a shield is always up in time. */
	TrampleCadence: {abilityId: 'Trample', delay: 4000, interval: 7000},

	/** Spore seeks the healer without changing Sivi's standing preference. */
	SporeCadence: {
		abilityId: 'Spore',
		delay: 500,
		interval: 10000,
		preference: 'healerFirst',
	},

	/** The puffball's sigh — slow enough that each tick is a chip, not a wound. */
	WaftCadence: {abilityId: 'Waft', delay: 2000, interval: 4000},

	/** The delay is the whole "joins late" lesson; the sap shell lasts for the same time. */
	GrubWakeCadence: {abilityId: 'HeavyBlow', delay: 6000, interval: 3800},

	/** A grub buried deeper in its shell, for a staggered room. */
	GrubWakeCadenceLate: {abilityId: 'HeavyBlow', delay: 13000, interval: 3800},

	/** The guardian's slow wind-up. Wide enough that a shield or a dodge always fits. */
	GroundfallCadence: {abilityId: 'Groundfall', delay: 5000, interval: 9000},

	/** Sivi reuses Ambush on a faster beat than Skulker. */
	SiviAmbushCadence: {abilityId: 'Ambush', delay: 3000, interval: 6000},

	/** Hollow seeks the healer without changing its owner's standing preference. */
	HollowCadence: {
		abilityId: 'Hollow',
		delay: 2000,
		interval: 4000,
		preference: 'healerFirst',
	},

	/** Gale's road-chip — slower than Wren's, quicker than Clover's. */
	GaleSlingCadence: {abilityId: 'Sling', delay: 500, interval: 2400},

	/** Refreshes Wind while Gale stands; the last planted Wind outlives her by about two beats. */
	GaleWindCadence: {abilityId: 'Wind', delay: 3000, interval: 6000},
} satisfies Record<string, CadenceTemplate>
