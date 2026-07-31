import type {GameLoop} from './nodes/game-loop'
import type {InspectableSection} from './inspectables/contracts'
import {balanceInspectableSections} from './inspectables/balance-inspectables'
import {liveInspectableSections} from './inspectables/live-inspectables'

export type {Action, BooleanField, Field, Inspectable, InspectableSection, NumberField} from './inspectables/contracts'
export {globalsInspectable, liveInspectables} from './inspectables/live-inspectables'

/** The Balance Lab's stable façade: live controls first, then every tunable balance category. */
export function allInspectables(game: GameLoop): InspectableSection[] {
	return [...liveInspectableSections(game), ...balanceInspectableSections(game)]
}
