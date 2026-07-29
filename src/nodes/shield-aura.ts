import {applyStatics, log} from '../utils'
import {logCombat, type CombatLogEvent} from '../combatlog'
import {Aura} from './aura'
import type {Unit} from './unit'

/**
 * An aura with a pool of absorption: it swallows damage instead of moving a health bar.
 *
 * Nothing happens when it lands and nothing happens on a cadence — it changes how a *later* hit
 * resolves, which is why the absorbing is reached from `applyHit` and not from a tick here.
 *
 * Attaching, stacking and going away all live on `Aura`. This class is only the pool.
 */
export class ShieldAura extends Aura {
	/** Damage this shield can still swallow. It empties, and the shield is over. */
	pool = 0

	/**
	 * A shield has no cadence, so the task dials say only "wait, then be done": one cycle
	 * (`repeat = 1`) that does not start until the whole lifetime has passed (`delay`, set from
	 * `lifetime` below). vroum disconnects a task once its cycles reach `repeat`, so the single
	 * tick *is* the expiry — there is no instalment here to mistake it for.
	 */
	repeat = 1

	static id = 'Shield'
	static name = 'Shield'
	static pool = 0
	/**
	 * How long an unspent shield lasts, in ms. Mirrored onto `Task.delay` at construction, the way
	 * `Ability.castTime` is.
	 *
	 * Not a balance number: `AURA_KEYS` holds a periodic aura's dials, which a shield has none of,
	 * and the number worth tuning — the pool — already rides on the casting spell's `magnitude`.
	 */
	static lifetime = 15000

	/**
	 * `pool` overrides the class default so a spell can own the number — see `Shield`,
	 * which keeps it as its `heal` where the balance lab can reach it. Same arrangement as
	 * `PeriodicAura`'s `total`.
	 */
	constructor(parent: Unit, caster: Unit, pool?: number) {
		super(parent, caster)
		applyStatics(this, 'pool')
		if (pool !== undefined) this.pool = pool
		this.delay = (this.constructor as typeof ShieldAura).lifetime
	}

	/**
	 * Take what this shield can of an incoming hit, and say how much that was. The caller
	 * subtracts it before anything touches the health bar — see `applyHit`.
	 */
	absorb(damage: number): number {
		const absorbed = Math.min(this.pool, damage)
		if (absorbed <= 0) return 0
		this.pool -= absorbed

		logCombat({
			timestamp: Date.now(),
			eventType: 'SPELL_ABSORBED',
			// The shield's caster, not whoever swung: this is the shield doing something, and the
			// report credits prevention the way it credits healing.
			sourceId: this.casterId,
			sourceName: this.casterName,
			targetId: this.parent.id,
			targetName: this.parent.name || 'Unknown',
			abilityId: this.id,
			abilityName: this.name,
			value: absorbed,
		})

		// An empty shield is a spent one. It leaves `auras` here rather than on the microtask
		// `disconnect()` defers to, so a second hit in the same tick — and the unit frame — never
		// walk a shield with nothing left in it. Same reason `supersede()` does it by hand.
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
