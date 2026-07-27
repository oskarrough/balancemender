import {Task} from 'vroum'
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
	 * replaces what is there and the duration starts over, which is Classic Renew and Classic
	 * Shadow Word: Pain. Higher stacks — each cast adds a copy, and past the cap the one closest
	 * to expiring falls off.
	 *
	 * The default is 1 because unbounded stacking is not a design, it is the absence of one:
	 * Renew is instant and the GCD is 1500ms, so uncapped it is 80 healing a second at the best
	 * heal-per-mana in the game, and the ladder in `spells.ts` — where throughput is supposed to
	 * cost efficiency — stops meaning anything. Raise it deliberately, and give the Nth cast a
	 * reason to differ from the first (a bloom on expiry, diminishing stacks) or a stack is only
	 * a multiplier with extra bookkeeping.
	 */
	maxStacks = 1

	casterName = ''
	casterId = ''

	/** Replaced by a fresh copy rather than run out. See `supersede`. */
	superseded = false

	/**
	 * Already torn down. vroum's `disconnect()` is not idempotent — it queues `_runDestroy`
	 * unconditionally, and the second run finds `root` reset to the node itself and throws from
	 * `Task.destroy`'s `this.root._kill(this)`.
	 *
	 * Auras are the one node type several unrelated callers can reach: `supersede()` when a
	 * fresh copy lands, `Encounter.onDeath()` when the unit carrying it falls. Neither can know
	 * about the other, so the guard belongs here rather than at every call site.
	 */
	private detached = false

	/**
	 * Stable key — `balance.auras`, `--tune`, the log's `abilityId`, the stack key. See
	 * `Spell.id`. An aura a spell owns takes that spell's id (`Renew`) so the cast and the ticks
	 * report as one thing; a free-standing one keeps its own (`Rend`).
	 */
	static id = 'Aura'
	/**
	 * Display only.
	 *
	 * Every subclass must declare its own, because `name` is already an own property of every
	 * class object — `class Shield extends Aura {}` reads back `'Shield'`, never the `'Aura'`
	 * here. Harmless while the id convention is the class name, and a trap the moment a display
	 * name is meant to differ from it.
	 */
	static name = 'Aura'
	static maxStacks = 1

	/**
	 * `parent` is the unit it lands on; `caster` is who to credit it to.
	 */
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
	 * What counts as the same aura for stacking. Id and caster, so two healers can each keep
	 * a Renew on the tank — moot with one player, but it is the rule that survives a second one.
	 * Override to widen it: a debuff that should be unique on the target however many enemies
	 * apply it drops the caster from the key.
	 *
	 * The id rather than the display name, so renaming what a player reads cannot silently split
	 * one aura into two that no longer stack against each other.
	 */
	get stackKey() {
		return `${this.id}:${this.casterId}`
	}

	mount() {
		const existing = [...this.parent.auras].filter((aura) => aura.stackKey === this.stackKey)
		// Insertion order is chronological, so the front of the list is closest to expiring.
		// Collect before removing: `supersede` deletes from the set this walked.
		const replaced = existing.slice(0, Math.max(0, existing.length + 1 - this.maxStacks))
		// What a pushed-off copy leaves unfinished rides on the refresh. `supersede()` logs no
		// removal of its own by design, so this is the only chance to say it: recast a shield with
		// half its pool left and that half is wasted exactly as if it had timed out.
		const unfinished = replaced.reduce((carried, stale) => ({...carried, ...stale.removalFields()}), {})
		for (const stale of replaced) stale.supersede()

		this.parent.auras.add(this)
		const stacks = [...this.parent.auras].filter((aura) => aura.stackKey === this.stackKey).length
		this.logAura(existing.length ? 'SPELL_AURA_REFRESH' : 'SPELL_AURA_APPLIED', stacks, unfinished)
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
		if (!this.superseded) {
			const stacks = [...this.parent.auras].filter((aura) => aura.stackKey === this.stackKey).length
			this.logAura('SPELL_AURA_REMOVED', stacks, this.removalFields())
		}
		log('aura:destroy', this.name)
	}

	/**
	 * What this aura leaves unfinished, for its own removal event. Nothing here, because what
	 * counts as unfinished depends on what the aura was doing: a periodic one has already landed
	 * everything it landed, while `ShieldAura` reports the pool nobody spent — the only trace a
	 * spell that prevents damage leaves when it goes to waste.
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
