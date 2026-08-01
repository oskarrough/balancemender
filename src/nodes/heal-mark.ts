import {Aura} from './aura'
import type {Unit} from './unit'

/**
 * Heal-mark: a gate aura on the healer makes each successful heal plant an exclusive threat-mark on
 * the patient. The mark multiplies threat credited for that ally (damage they deal; heals they
 * receive while the gate is up), so prefer.threat enemies stick to whoever was just healed. The gate
 * itself does not redirect threat — it only enables the plant.
 */

type MarkClass = typeof ThreatMark
type GateClass = typeof HealMarkGate

/** While present on a unit, multiplies threat credited for that unit's damage. */
export class ThreatMark extends Aura {
	repeat = 1

	static id = 'ThreatMark'
	static name = 'Threat mark'
	/** +500% → 6×. Subclasses tune this; heal credit under a gate reads the same number. */
	static threatWeight = 6
	static lifetime = 5000
	/**
	 * Fight-wide exclusive: planting on one unit clears every other copy of this id. Off by default
	 * so a plain lasting weight does not surprise; heal-marks opt in.
	 */
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
			for (const aura of stale) aura.supersede()
		}
	}
}

/**
 * Healer-side gate. While present, successful heals plant `mark` on the patient and credit that
 * heal's threat to them at the mark's `threatWeight`.
 */
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

function gateOn(unit: Unit): HealMarkGate | undefined {
	for (const aura of unit.auras) {
		if (aura instanceof HealMarkGate) return aura
	}
	return undefined
}

/** Threat weight from a living ThreatMark on this unit (damage path). */
export function damageThreatWeight(unit: Unit) {
	for (const aura of unit.auras) {
		if (aura instanceof ThreatMark) return (aura.constructor as MarkClass).threatWeight
	}
	return 1
}

/**
 * Threat weight for a heal from this caster while a gate is up, else undefined.
 * Used before the mark is planted so the planting heal itself pulls.
 */
export function healMarkThreatWeight(healer: Unit) {
	const gate = gateOn(healer)
	if (!gate) return undefined
	return ((gate.constructor as GateClass).mark as MarkClass).threatWeight
}

/** Plant (or move) the gate's mark on the patient. No-op without a gate. */
export function afterSuccessfulHeal(source: Unit, target: Unit, castId?: string) {
	const gate = gateOn(source)
	if (!gate || !target.alive) return
	const Mark = (gate.constructor as GateClass).mark
	new Mark(target, source, {castId})
}
