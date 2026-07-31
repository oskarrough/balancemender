import {applyStatics, log} from '../utils'
import type {CombatLogEvent} from '../combatlog'
import {Aura} from './aura'
import type {PlantedAura} from './effects'
import type {GameLoop} from './game-loop'
import type {Unit} from './unit'

/**
 * An aura with a pool of absorption: it swallows damage instead of moving a health bar.
 *
 * Nothing happens when it lands and nothing happens on a cadence — it changes how a *later* hit
 * resolves, which is why the absorbing is reached from `applyHit` and not from a tick here.
 *
 * Attaching, stacking and going away all live on `Aura`. This class is only the pool.
 */
export class BarrierAura extends Aura {
	/** Damage this barrier can still swallow. It empties, and the barrier is over. */
	pool = 0

	/**
	 * A barrier has no cadence, so the task dials say only "wait, then be done": one cycle
	 * (`repeat = 1`) that does not start until the whole lifetime has passed (`delay`, set from
	 * `lifetime` below). vroum disconnects a task once its cycles reach `repeat`, so the single
	 * tick *is* the expiry — there is no instalment here to mistake it for.
	 */
	repeat = 1

	/** Neutral identity; an ability-owned barrier borrows that ability's identity in a subclass. */
	static id = 'Barrier'
	static name = 'Barrier'
	// Ability-owned subclasses inherit the mechanic label even when their id names the ability.
	static mechanic = 'barrier'
	static pool = 0
	/**
	 * How long an unspent barrier lasts, in ms. Mirrored onto `Task.delay` at construction, the way
	 * `Ability.castTime` is.
	 *
	 * Not a balance number: `AURA_KEYS` holds a periodic aura's dials, which a barrier has none of,
	 * and the pool already arrives as the planting effect's resolved magnitude.
	 */
	static lifetime = 15000

	/**
	 * The effect that planted this barrier sizes its pool — see `Shield`, whose apply-aura effect
	 * owns the coefficient. A class default only stands in for a barrier constructed without one.
	 */
	constructor(parent: Unit, caster: Unit, planted?: PlantedAura) {
		super(parent, caster)
		applyStatics(this, 'pool')
		if (planted) {
			this.pool = planted.magnitude
			this.castId = planted.castId
		}
		this.delay = (this.constructor as typeof BarrierAura).lifetime
	}

	/**
	 * Take what this barrier can of an incoming hit, and say how much that was. The caller
	 * subtracts it before anything touches the health bar — see `applyHit`.
	 */
	absorb(damage: number): number {
		const absorbed = Math.min(this.pool, damage)
		if (absorbed <= 0) return 0
		this.pool -= absorbed

		const {combatLog} = this.root as GameLoop
		combatLog.add({
			timestamp: Date.now(),
			eventType: 'SPELL_ABSORBED',
			// The barrier's caster, not whoever swung: this is the barrier doing something, and the
			// report credits prevention the way it credits healing.
			sourceId: this.casterId,
			sourceName: this.casterName,
			targetId: this.parent.id,
			targetName: this.parent.name || 'Unknown',
			abilityId: this.id,
			abilityName: this.name,
			castId: this.castId,
			value: absorbed,
		})

		// An empty barrier is a spent one. It leaves `auras` here rather than on the microtask
		// `disconnect()` defers to, so a second hit in the same tick — and the unit frame — never
		// walk a barrier with nothing left in it. Same reason `supersede()` does it by hand.
		if (this.pool <= 0) {
			log('aura:spent', this.name)
			this.parent.auras.delete(this)
			this.pause()
			this.disconnect()
		}

		return absorbed
	}

	/** Unspent absorption is this spell's overheal. See `wasted` in combatlog.ts. */
	protected removalFields(): Partial<CombatLogEvent> {
		return {wasted: this.pool}
	}
}
