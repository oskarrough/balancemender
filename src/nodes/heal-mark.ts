import {Aura} from './aura'
import type {Unit} from './unit'

/**
 * Heal-mark: a gate aura on the healer makes each heal plant an exclusive mark on its
 * living target. Authored enemies may seek that mark directly; threat remains unchanged.
 */

type MarkClass = typeof ThreatMark
type GateClass = typeof HealMarkGate

/** A timed mark that an authored targeting preference may seek directly. */
export class ThreatMark extends Aura {
	repeat = 1

	static id = 'ThreatMark'
	static name = 'Threat mark'
	static lifetime = 5000
	/** Fight-wide exclusive: planting on one unit clears every other copy of this id. */
	static exclusive = false

	constructor(parent: Unit, caster: Unit, plantedAura?: {castId?: string}) {
		super(parent, caster)
		if (plantedAura) this.castId = plantedAura.castId
		this.delay = (this.constructor as MarkClass).lifetime
	}

	get stackKey() {
		return this.id
	}

	mount() {
		const Mark = this.constructor as MarkClass
		if (!Mark.exclusive) return
		// Runs after Aura.mount in the lifecycle chain — do not call super.mount() or Aura.mount
		// runs twice, self-supersedes, and the deferred destroy leaves the set empty.
		for (const unit of this.parent.parent.units) {
			if (unit === this.parent) continue
			const stale = [...unit.auras].filter((aura) => aura.id === this.id)
			for (const aura of stale) aura.supersede({extraInfo: `moved to ${this.parent.name}`})
		}
	}
}

/** Healer-side gate. While present, heals plant `mark` on their living target. */
export class HealMarkGate extends Aura {
	repeat = 1

	static id = 'HealMarkGate'
	static name = 'Heal mark gate'
	static lifetime = 9000
	/** Which exclusive mark this gate plants. Subclasses must set their own. */
	static mark: MarkClass = ThreatMark

	constructor(parent: Unit, caster: Unit, plantedAura?: {castId?: string}) {
		super(parent, caster)
		if (plantedAura) this.castId = plantedAura.castId
		this.delay = (this.constructor as GateClass).lifetime
	}

	/** One gate of this id on the healer, whoever applied it. */
	get stackKey() {
		return this.id
	}
}

/** Plant (or move) the gate's mark on the target. No-op without a gate or a living target. */
export function afterHeal(source: Unit, target: Unit, castId?: string) {
	let gate: HealMarkGate | undefined
	for (const aura of source.auras) {
		if (aura instanceof HealMarkGate) {
			gate = aura
			break
		}
	}
	if (!gate || !target.alive) return
	const Mark = (gate.constructor as GateClass).mark
	new Mark(target, source, {castId})
}
