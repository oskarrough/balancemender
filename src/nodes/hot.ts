import {Task} from 'vroum'
import {fct} from '../components/floating-combat-text'
import {log} from '../utils'
import {Character} from './character'
import { logCombat } from '../combatlog'

export class HOT extends Task {
	name = 'Periodic Heal'
	heal = 0
	interval = 3000
	repeat = 5

	constructor(public parent: Character) {
		super(parent)
	}

	mount() {
		// Add self to parent's effects when mounted
		this.parent.effects.add(this)
		log('hot:mount', this.name)
	}

	tick() {
		const character = this.parent
		const heal = this.heal / this.repeat

		character.health.heal(heal)

		fct(`+${heal}`)

		logCombat({
			timestamp: Date.now(),
			eventType: 'PERIODIC_SPELL_HEAL',
			sourceId: this.parent.id,
			sourceName: this.parent.name,
			targetId: this.parent.id,
			targetName: this.parent.name || 'Unknown',
			spellId: this.name,
			spellName: this.name,
			value: heal,
		})
	}

	destroy() {
		// Remove self from parent's effects when destroyed
		this.parent.effects.delete(this)
		log('hot:destroy', this.name)
	}
}
