import {Task} from 'vroum'
import type {CombatEventType} from '../combatlog'
import {applyStatics, randomIntFromInterval} from '../utils'
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
	heal?: number
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
	declare static heal?: number
	declare static castTime?: number
	declare static cooldown?: number
	declare static gcd?: boolean
	declare static minDamage?: number
	declare static maxDamage?: number
	declare static sound?: string
	declare static eventType?: CombatEventType

	constructor(public parent: Unit) {
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
			'heal',
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

	/** The current target, constrained by this ability's own rule until explicit targeting lands in #56. */
	get target() {
		const target = this.parent.getTarget()
		return target && eligible(this.parent, this.targetRule).includes(target) ? target : undefined
	}

	/** Run what this ability does, in the order it declares it, and then say it out loud. */
	land() {
		const target = this.target
		if (!target) return
		for (const effect of this.effects) effect.apply(this, target)
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

	stopSounds() {
		AudioPlayer.stopOwned(this)
	}

	destroy() {
		AbilityUse.finish(this)
	}

	/** The flinch a hit draws on its target. Public because the Damage effect is what lands the hit. */
	shakeTarget(target: Unit) {
		const element = document.querySelector(`[data-unit-id="${target.id}"] .Unit-avatar`)
		if (!element) return
		element.classList.add('is-takingDamage')
		const animation = element.animate(
			[
				{transform: 'translate(0, 0)', filter: 'none'},
				{
					transform: `translate(${randomIntFromInterval(-2, 2)}px, ${randomIntFromInterval(-2, 2)}px)`,
					filter: 'brightness(0.5)',
				},
				{transform: 'translate(0, 0)', filter: 'none'},
			],
			{duration: 200, easing: 'ease-in-out'},
		)
		animation.onfinish = () => element.classList.remove('is-takingDamage')
	}
}
