import {DEMO_ROSTER, type Roster} from './nodes/encounter'
import {GameLoop} from './nodes/game-loop'
import {Tank} from './nodes/party-units'
import {SimLoop} from './sim/run'

const tankOrThrow = (tank: Tank | undefined): Tank => {
	if (!tank) throw new Error('Tank test fixture requires a tank-bearing roster')
	return tank
}

/** Narrow a mixed test's active game after its setup has installed a tank-bearing fixture. */
export function requireTank<T extends GameLoop>(game: T): asserts game is T & {readonly tank: Tank} {
	tankOrThrow(game.tank)
}

/** A GameLoop fixture for tests whose roster and assertions specifically require a tank. */
export class TankGameLoop extends GameLoop {
	constructor(roster: Roster = DEMO_ROSTER) {
		super(roster)
		tankOrThrow(super.tank)
	}

	override get tank(): Tank {
		return tankOrThrow(super.tank)
	}
}

/** The stepped-clock counterpart to TankGameLoop. */
export class TankSimLoop extends SimLoop {
	constructor(roster: Roster = DEMO_ROSTER) {
		super(roster)
		tankOrThrow(super.tank)
	}

	override get tank(): Tank {
		return tankOrThrow(super.tank)
	}
}
