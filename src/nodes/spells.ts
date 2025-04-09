import {Spell} from './spell'
import {HOT} from './hot'
import {GameLoop} from './game-loop'
import {AudioPlayer} from './audio'
import {Character} from './character'

export class Heal extends Spell {
	static name = 'Heal'
	static cost = 50
	static heal = 75
	static castTime = 2000
}

export class FlashHeal extends Spell {
	static name = 'Flash Heal'
	static cost = 75
	static heal = 100
	static castTime = 1000
}

export class GreaterHeal extends Spell {
	static name = 'Greater Heal'
	static cost = 100
	static heal = 150
	static castTime = 3000
}

/** Renew heals indirectly by applying RenewHOT */
export class Renew extends Spell {
	static name = 'Renew'
	static cost = 60
	static castTime = 0

	tick() {
		const player = this.parent
		const target = player.currentTarget
		if (target) {
			new RenewHOT(target)
			AudioPlayer.play('spell.rejuvenation')
		}
	}
}

class RenewHOT extends HOT {
	static name = 'Renew'
	static heal = 30
	static interval = 2000
	static repeat = 5

	constructor(parent: Character) {
		super(parent)
		// Copy static properties to instance
		this.name = RenewHOT.name
		this.heal = RenewHOT.heal
		this.interval = RenewHOT.interval
		this.repeat = RenewHOT.repeat
	}
}
