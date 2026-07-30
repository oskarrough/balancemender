import type {Unit} from './unit'

/** Which units an ability may land on at all. A fact about the ability, not its driver. */
export type Targets = 'enemy' | 'ally' | 'self'

/** The living units `targets` allows this unit to use an ability on right now. */
export function eligible(unit: Unit, targets: Targets): Unit[] {
	if (targets === 'self') return unit.alive ? [unit] : []
	const own = unit.faction === 'party' ? unit.parent.party : unit.parent.enemies
	const other = unit.faction === 'party' ? unit.parent.enemies : unit.parent.party
	return (targets === 'ally' ? own : other).filter((target) => target.alive)
}
