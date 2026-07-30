import {DEMO_ROOM, type Room} from './nodes/fight'
import {GameLoop} from './nodes/game-loop'
import {Tank} from './nodes/party-units'
import {SimLoop} from './sim/run'

const tankOrThrow = (tank: Tank | undefined): Tank => {
	if (!tank) throw new Error('Tank test fixture requires a tank-bearing room')
	return tank
}

/** Narrow a mixed test's active game after its setup has installed a tank-bearing fixture. */
export function requireTank<T extends GameLoop>(game: T): asserts game is T & {readonly tank: Tank} {
	tankOrThrow(game.tank)
}

/** A GameLoop fixture for tests whose room and assertions specifically require a tank. */
export class TankGameLoop extends GameLoop {
	constructor(room: Room = DEMO_ROOM) {
		super(room)
		tankOrThrow(super.tank)
	}

	override get tank(): Tank {
		return tankOrThrow(super.tank)
	}
}

/** The stepped-clock counterpart to TankGameLoop. */
export class TankSimLoop extends SimLoop {
	constructor(room: Room = DEMO_ROOM) {
		super(room)
		tankOrThrow(super.tank)
	}

	override get tank(): Tank {
		return tankOrThrow(super.tank)
	}
}
