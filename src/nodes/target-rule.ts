import type {Unit} from './unit'

/** Which units an ability may land on at all. A fact about the ability, not its driver. */
export type TargetRule = 'enemy' | 'ally' | 'self'

/** The living units a rule allows this unit to use an ability on right now. */
export function eligible(unit: Unit, rule: TargetRule): Unit[] {
	if (rule === 'self') return unit.alive ? [unit] : []
	const own = unit.faction === 'party' ? unit.parent.party : unit.parent.enemies
	const other = unit.faction === 'party' ? unit.parent.enemies : unit.parent.party
	return (rule === 'ally' ? own : other).filter((target) => target.alive)
}
