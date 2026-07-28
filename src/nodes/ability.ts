import {Task} from 'vroum'
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
	minDamage?: number
	maxDamage?: number
	sound = ''
	eventType: CombatEventType = 'SPELL_DAMAGE'
	/**
	 * What this ability does when it lands, in order. Everything an ability does to the world is in
	 * here — no subclass reaches into the lifecycle to add an outcome of its own.
	 */
	effects: readonly Effect[] = []
	private used = false

	static id = ''
	static name = ''
	static tags: readonly AbilityTag[] = []
	static school: AbilitySchool = 'physical'
	static targetRule: TargetRule = 'enemy'
	static icon = ''
	static effects: readonly Effect[] = []
	declare static cost?: number
	declare static magnitude?: number
	declare static castTime?: number
	declare static cooldown?: number
	declare static gcd?: boolean
	declare static minDamage?: number
	declare static maxDamage?: number
	declare static sound?: string
	declare static eventType?: CombatEventType

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
			'minDamage',
			'maxDamage',
			'sound',
			'eventType',
		)
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
		for (const effect of this.effects) effect.apply(this, this.target)
		this.playLandingSound()
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
