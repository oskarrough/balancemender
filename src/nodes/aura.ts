import {Task} from '../vroum'
import {applyStatics, log} from '../utils'
import {logCombat, type CombatLogEvent} from '../combatlog'
// Type-only both ways: unit.ts names this class for its `auras` set.
import type {Unit} from './unit'

/**
 * Something that sits on a unit for a while: a source, a lifetime, and a place in the unit's
 * `auras` set until it expires.
 *
 * This class is only about an aura's presence — how it attaches, how it stacks, how it goes
 * away. What an aura *does* while it is there belongs to a subclass: see `PeriodicAura` for one
 * that lands in instalments.
 */
export class Aura extends Task {
	id = 'Aura'
	name = 'Aura'
	/**
	 * How many copies of this aura one target can carry at once. `1` is a refresh: recasting
	 * replaces what is there and the duration starts over. Higher stacks add a copy per cast, and
	 * past the cap the one closest to expiring falls off.
	 *
	 * Default 1 because uncapped stacking undoes the ladder in `spells.ts`, where throughput is
	 * meant to cost efficiency. Raise it only where the Nth cast differs from the first.
	 */
	maxStacks = 1

	casterName = ''
	casterId = ''

	/** Replaced by a fresh copy rather than run out. See `supersede`. */
	superseded = false

	/**
	 * Already torn down. vroum's `disconnect()` is not idempotent — the second run finds `root`
	 * reset to the node itself and throws from `Task.destroy`. Two unrelated callers can reach an
	 * aura, `supersede()` and `Encounter.onDeath()`, so the guard lives here, not at each of them.
	 */
	private detached = false

	/**
	 * Stable key — `balance.auras`, `--tune`, the log's `abilityId`, the stack key. See
	 * `Ability.id`. An aura a spell owns takes that spell's id (`Renew`) so the cast and the ticks
	 * report as one thing; a free-standing one keeps its own (`Rend`).
	 */
	static id = 'Aura'
	/**
	 * Display only. Every subclass must declare its own: `name` is already an own property of every
	 * class object, so `class Shield extends Aura {}` reads back `'Shield'`, never this.
	 */
	static name = 'Aura'
	static maxStacks = 1

	/** `parent` is the unit it lands on; `caster` is who to credit it to. */
	constructor(
		public parent: Unit,
		public caster: Unit,
	) {
		super(parent)
		applyStatics(this, 'id', 'name', 'maxStacks')
		this.casterName = caster.name
		this.casterId = caster.id
	}

	/**
	 * What counts as the same aura for stacking: id and caster, so two healers can each keep a
	 * Renew on the tank. Override to widen it — a debuff meant to be unique on the target however
	 * many enemies apply it drops the caster. Keyed by id, never the display name, so renaming
	 * cannot split one aura into two that no longer stack.
	 */
	get stackKey() {
		return `${this.id}:${this.casterId}`
	}

	/** The copies on the target that stack with this one. Insertion order, so oldest first. */
	private get stacked() {
		return [...this.parent.auras].filter((aura) => aura.stackKey === this.stackKey)
	}

	mount() {
		const existing = this.stacked
		// Oldest first, so these are the ones closest to expiring. Collected before removing:
		// `supersede` deletes from the set this walked.
		const replaced = existing.slice(0, Math.max(0, existing.length + 1 - this.maxStacks))
		// What a pushed-off copy leaves unfinished rides on the refresh, because `supersede()` logs
		// no removal of its own: replace a barrier with half its pool left and that half is wasted
		// exactly as if it had timed out.
		const unfinished = Object.assign({}, ...replaced.map((stale) => stale.removalFields()))
		for (const stale of replaced) stale.supersede()

		this.parent.auras.add(this)
		this.logAura(existing.length ? 'SPELL_AURA_REFRESH' : 'SPELL_AURA_APPLIED', this.stacked.length, unfinished)
		log('aura:mount', this.name)
	}

	/**
	 * Pushed off by a fresh copy of itself. Leaves `auras` and stops ticking now rather than on
	 * the microtask `disconnect()` defers to, so what the unit frame draws and what `applyHit`
	 * sees never includes an aura that has already been replaced.
	 */
	supersede() {
		this.superseded = true
		this.parent.auras.delete(this)
		this.pause()
		this.disconnect()
	}

	/** Idempotent, unlike the base — see `detached`. */
	disconnect() {
		if (this.detached) return
		this.detached = true
		super.disconnect()
	}

	destroy() {
		this.parent.auras.delete(this)
		// A superseded aura already logged its replacement as a refresh. Saying it was removed
		// too would read as the target losing an aura it is still carrying.
		if (!this.superseded) this.logAura('SPELL_AURA_REMOVED', this.stacked.length, this.removalFields())
		log('aura:destroy', this.name)
	}

	/**
	 * What this aura leaves unfinished, for its own removal event. Nothing by default: a periodic
	 * aura has already landed what it landed, while `BarrierAura` reports the pool nobody spent.
	 */
	protected removalFields(): Partial<CombatLogEvent> {
		return {}
	}

	private logAura(
		eventType: 'SPELL_AURA_APPLIED' | 'SPELL_AURA_REFRESH' | 'SPELL_AURA_REMOVED',
		stacks: number,
		extra: Partial<CombatLogEvent> = {},
	) {
		logCombat({
			timestamp: Date.now(),
			eventType,
			sourceId: this.casterId,
			sourceName: this.casterName,
			targetId: this.parent.id,
			targetName: this.parent.name || 'Unknown',
			abilityId: this.id,
			abilityName: this.name,
			...extra,
			// Only when there is more than one, so the common case does not read as "(1 stack)".
			...(stacks > 1 && {extraInfo: `${stacks} stacks`}),
		})
	}
}
