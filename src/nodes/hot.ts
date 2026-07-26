import {Task} from 'vroum'
import {fct} from '../components/floating-combat-text'
import {applyStatics, log} from '../utils'
import {Character} from './character'
import {logCombat} from '../combatlog'

export class HOT extends Task {
	name = 'Periodic Heal'
	heal = 0
	interval = 3000
	repeat = 5

	casterName = ''
	casterId = ''

	static name = 'Periodic Heal'
	static heal = 0
	static interval = 3000
	static repeat = 5

	/** `parent` is the unit being healed; `caster` is who to credit the healing to. */
	constructor(
		public parent: Character,
		public caster: Character,
	) {
		super(parent)
		applyStatics(this, 'name', 'heal', 'interval', 'repeat')
		this.casterName = caster.name
		this.casterId = caster.id
	}

	mount() {
		// Add self to parent's effects when mounted
		this.parent.effects.add(this)
		log('hot:mount', this.name)
	}

	tick() {
		const character = this.parent
		const heal = this.heal / this.repeat

		const before = character.health.current
		character.health.heal(heal)
		const overheal = heal - (character.health.current - before)

		fct(`+${heal}`)

		logCombat({
			timestamp: Date.now(),
			eventType: 'SPELL_PERIODIC_HEAL',
			sourceId: this.casterId,
			sourceName: this.casterName,
			targetId: this.parent.id,
			targetName: this.parent.name || 'Unknown',
			spellId: this.name,
			spellName: this.name,
			value: heal,
			overheal,
		})
	}

	destroy() {
		// Remove self from parent's effects when destroyed
		this.parent.effects.delete(this)
		log('hot:destroy', this.name)
	}
}
