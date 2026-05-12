import {Node} from 'vroum'
import {Player} from './player'
import {Nakroth, TinyWolf} from './enemies'
import {Tank} from './party-characters'
import type {GameLoop} from './game-loop'
import type {Character} from './character'

type Enemy = Nakroth | TinyWolf

const alive = (c: {health?: {current: number}}) => !!c.health && c.health.current > 0

/**
 * Owns the party + enemies for a single fight. Subclass and override
 * `populate()` to define a new encounter variant; swap at runtime with
 * `GameLoop.loadEncounter(MyEncounter)`.
 *
 * `player` and `tank` are resolved once in `populate()` and read directly
 * thereafter — the UI hits them every render, so a per-access `find()` was wasteful.
 */
export class Encounter extends Node {
	party: Character[] = []
	enemies: Enemy[] = []
	player!: Player
	tank!: Tank

	constructor(public parent: GameLoop) {
		super(parent)
		this.populate()
		this.player = this.party.find((c) => c instanceof Player) as Player
		this.tank = this.party.find((c) => c instanceof Tank) as Tank
	}

	populate() {}

	isPartyDefeated() {
		return !this.party.some(alive)
	}

	isEnemiesDefeated() {
		return !this.enemies.some(alive)
	}
}

export class DemoEncounter extends Encounter {
	populate() {
		const tank = new Tank(this)
		const player = new Player(this)
		player.currentTarget = player
		this.party.push(tank, player)
		this.enemies.push(new TinyWolf(this))
	}
}
