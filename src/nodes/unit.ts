import {Node} from '../vroum'
import {Health, HEALTH_EVENTS} from './health'
import {Mana} from './mana'
import type {Encounter} from './encounter'
import type {Aura} from './aura'
import {createId, log} from '../utils'
import {Faction, FACTION, Condition, CONDITION_THRESHOLDS} from './types'
import type {UnitId} from './unit-registry'
import type {Ability, AbilityClass} from './ability'
import type {GlobalCooldown} from './global-cooldown'
import type {Targeting} from './targeting'
import {AbilityUse} from './ability-use'

export type {Aura} from './aura'
export type {Faction} from './types'
export {FACTION} from './types'
export {CONDITION_THRESHOLDS} from './types'
export type {Condition} from './types'

/**
 * Base unit class. Subclasses declare `static maxHealth = N` and the
 * base constructor wires up the Health node — defining `health` as a field
 * initializer in a subclass would create (and orphan) a second one.
 */
export class Unit extends Node {
	readonly id: string
	static maxHealth = 100
	/** Which side this unit fights on. Static so the registry can be read without spawning anyone. */
	static faction: Faction = FACTION.ENEMY

	name = ''
	image = ''
	/** The registry id this unit was spawned from. Survives minification; `constructor.name` does not. */
	unitId?: UnitId
	/** `name` before duplicate numbering, so renumbering stays idempotent. */
	baseName?: string
	health: Health
	mana?: Mana
	auras = new Set<Aura>()
	faction: Faction = (this.constructor as typeof Unit).faction
	/**
	 * How this unit's standing drivers choose among the units an ability may land on. A preference
	 * and nothing more — it holds no target the rest of the game reads back. The player has none:
	 * the keyboard is its own driver.
	 */
	targeting?: Targeting

	/**
	 * Still standing. This — not membership of `encounter.party`/`enemies` — is who is in the
	 * fight: the dead stay in those arrays. See `Encounter.onDeath()`.
	 */
	get alive() {
		return this.health.current > 0
	}

	/**
	 * Which band of its health bar this unit is in — what an ability reads instead of writing its
	 * own percentage.
	 *
	 * A pure function of health, with no memory: no hysteresis, no latch. That is what keeps it
	 * safe to ask anywhere, and what a threshold tunable mid-fight would break if it were compared
	 * against a stored state.
	 *
	 * Through `ratio`, not `current * 100`: multiplying an already-inexact health value pushes a
	 * unit sitting exactly on a threshold across it.
	 */
	get condition(): Condition {
		const percent = this.health.ratio * 100
		if (percent < CONDITION_THRESHOLDS.injured) return 'injured'
		if (percent > CONDITION_THRESHOLDS.healthy) return 'healthy'
		return 'steady'
	}

	/**
	 * Orthogonal to `alive`, deliberately: a corpse sits at 0% and so reads `injured`. Every
	 * consumer in the game already filters the dead before asking anything else, and a fourth
	 * `'dead'` condition would be a second source of truth for what `alive` already owns.
	 */
	get injured() {
		return this.condition === 'injured'
	}

	get healthy() {
		return this.condition === 'healthy'
	}

	/** Every ability this unit may use, keyed by stable ability id. Display names never enter lookup. */
	abilities: Record<string, AbilityClass> = {}

	/** Only abilities opting into cast time or GCD occupy this slot; ordinary attacks never do. */
	lastCastTime = 0
	lastCastCompletedTime = 0
	currentAbility: Ability | undefined
	gcd: GlobalCooldown | undefined

	/** Cooldown expiry stamps in fight-clock ms, keyed by stable ability id. */
	cooldowns = new Map<string, number>()

	/**
	 * The neutral primitive every driver uses. The target belongs to this one use: whoever decided
	 * to act also decided who it lands on, and hands both over together.
	 */
	useAbility(abilityId: string, target?: Unit) {
		return AbilityUse.use(this, abilityId, target)
	}

	constructor(public parent: Encounter) {
		super(parent)
		this.id = createId()
		this.health = new Health(this, (this.constructor as typeof Unit).maxHealth)
		this.health.on(HEALTH_EVENTS.EMPTY, this.onHealthEmpty)
	}

	/**
	 * Dying is the encounter's business, not the unit's. This used to call `this.disconnect()`,
	 * which left the corpse half in and half out: vroum's teardown nulls `parent`, but the unit
	 * stayed in `encounter.party`, so anything that walked that array and reached back up the
	 * tree — `Player.intendedTarget` reads `this.parent.tank` — threw from the first death onwards.
	 */
	private onHealthEmpty = () => {
		log(`${this.name} is dead`)
		this.parent.onDeath(this)
	}

	damage(amount: number) {
		return this.health.damage(amount)
	}
}
