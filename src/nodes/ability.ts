import {Task} from '../vroum'
import type {CombatEventType} from '../combatlog'
import {applyStatics} from '../utils'
import {AudioPlayer} from './audio'
import {AbilityUse} from './ability-use'
import {eligible, type TargetRule} from './target-rule'
import type {Effect} from './effects'
import type {Unit} from './unit'

export const ABILITY_TAGS = ['spell', 'attack', 'healing', 'melee', 'ranged'] as const
export type AbilityTag = (typeof ABILITY_TAGS)[number]
export type AbilitySchool = 'physical' | 'holy' | 'fire'
export type AbilityClass = typeof Ability

/**
 * Sweet spot fallbacks (#33), used whenever a `sweetSpot` ability doesn't override its own dial —
 * so `static sweetSpot = true` is the whole of enabling it on a new spell. A spell that wants its
 * own timing or reward adds `static sweetSpotWindow` / `static sweetSpotBonus` alongside it, which
 * also makes that one spell's dial reachable from the Balance Lab.
 */
export const DEFAULT_SWEET_SPOT_WINDOW = 500
export const DEFAULT_SWEET_SPOT_BONUS = 0.5

/**
 * One use of anything a unit can do. The Task is always one-shot; a Cadence or another driver
 * decides when to create the next use. Cast rules are opt-in static data on concrete abilities.
 */
export class Ability extends Task {
	repeat = 1

	id = ''
	name = ''
	tags: readonly AbilityTag[] = []
	school: AbilitySchool = 'physical'
	targetRule: TargetRule = 'enemy'
	icon = ''
	cost?: number
	magnitude?: number
	cooldown?: number
	gcd = false
	threatMultiplier = 1
	sound = ''
	eventType: CombatEventType = 'SPELL_DAMAGE'
	/**
	 * What this ability does when it lands, in order. Everything an ability does to the world is in
	 * here — no subclass reaches into the lifecycle to add an outcome of its own.
	 */
	effects: readonly Effect[] = []
	private used = false

	/** Opts into the tap-to-confirm sweet spot (#33). Resolved from the static the same as everything else. */
	sweetSpot = false
	/**
	 * Whether this cast was tapped-to-confirm inside its sweet spot window (#33). Set by
	 * `AbilityUse.confirmSweetSpot`, read by `land()` to reward it — generic to whatever effects
	 * the ability declares, so no effect class has to know the sweet spot exists.
	 */
	sweetSpotHit = false
	/** Resolved to a default in the constructor once `sweetSpot` is on, so every reader — the cast
	 * bar, the confirm check, the bonus below — sees a real number without repeating `?? DEFAULT`. */
	sweetSpotWindow?: number
	sweetSpotBonus?: number

	static id = ''
	static name = ''
	static tags: readonly AbilityTag[] = []
	static school: AbilitySchool = 'physical'
	static targetRule: TargetRule = 'enemy'
	static icon = ''
	static effects: readonly Effect[] = []
	/** Per-spell opt-in for the tap-to-confirm sweet spot (#33). Off unless a subclass says so. */
	static sweetSpot = false
	declare static cost?: number
	declare static magnitude?: number
	declare static castTime?: number
	declare static cooldown?: number
	declare static gcd?: boolean
	static threatMultiplier = 1
	declare static sound?: string
	declare static eventType?: CombatEventType
	/** The last stretch of the cast, in ms, a confirming tap must land in. A balance dial. */
	declare static sweetSpotWindow?: number
	/** Extra magnitude a sweet-spot hit adds, as a fraction — 0.5 is +50%. A balance dial. */
	declare static sweetSpotBonus?: number

	constructor(
		public parent: Unit,
		/**
		 * Who this one use lands on, decided by the driver that asked for it. `readonly` on purpose:
		 * a cast holds the target it started with, and nothing may swap one under it.
		 */
		public readonly target: Unit,
	) {
		super(parent)
		applyStatics(
			this,
			'id',
			'name',
			'tags',
			'school',
			'targetRule',
			'icon',
			'effects',
			'cost',
			'magnitude',
			'cooldown',
			'gcd',
			'threatMultiplier',
			'sound',
			'eventType',
			'sweetSpot',
			'sweetSpotWindow',
			'sweetSpotBonus',
		)
		if (this.sweetSpot) {
			this.sweetSpotWindow ??= DEFAULT_SWEET_SPOT_WINDOW
			this.sweetSpotBonus ??= DEFAULT_SWEET_SPOT_BONUS
		}
		this.delay = (this.constructor as AbilityClass).castTime ?? 0
	}

	mount() {
		AbilityUse.mount(this)
	}

	tick() {
		if (this.used) return
		this.used = true
		AbilityUse.succeed(this)
		this.land()
		AbilityUse.complete(this)
	}

	/** Execute an already validated ordinary ability in its driver's current tick. */
	executeNow() {
		if (this.used) return false
		this.tick()
		return true
	}

	/** Run what this ability does, in the order it declares it, and then say it out loud. */
	land() {
		// Eligibility was settled when the use was requested, but a cast outlives the moment it
		// started: the target can die, and it can be removed from the fight outright. Removal is not
		// death — `Encounter.remove()` leaves the health bar full — so `alive` cannot see it and
		// only eligibility can. Landing on someone who has left logs a hit naming a unit the report
		// has never heard of, and plants auras on a node vroum has already detached.
		if (!this.target.alive || !eligible(this.parent, this.targetRule).includes(this.target)) return
		if (this.sweetSpotHit) this.applySweetSpotBonus()
		for (const effect of this.effects) effect.apply(this, this.target)
		this.playLandingSound()
	}

	/** Scales the resolved outcome before any effect reads it. */
	private applySweetSpotBonus() {
		const bonus = 1 + (this.sweetSpotBonus ?? DEFAULT_SWEET_SPOT_BONUS)
		if (this.magnitude !== undefined) this.magnitude *= bonus
	}

	/**
	 * One sound as the ability lands. An ability with a `sound` of its own plays that — an attack's
	 * impact, Renew's chime — and a cast without one falls back to the generic cast chime, which is
	 * also the moment to stop the looping precast it has been playing.
	 */
	private playLandingSound() {
		AudioPlayer.stopOwned(this)
		const sound = this.sound || (AbilityUse.usesCastRules(this.constructor as AbilityClass) ? 'spell_cast' : '')
		if (sound) AudioPlayer.play(sound, {owner: this})
	}

	destroy() {
		AbilityUse.finish(this)
	}
}
