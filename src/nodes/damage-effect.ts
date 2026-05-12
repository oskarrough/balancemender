import {Task} from 'vroum'
import {applyStatics, html, randomIntFromInterval} from '../utils'
import {AudioPlayer} from './audio'
import {Character} from './character'
import {logCombat, CombatEventType} from '../combatlog'
import {getFctContainer} from '../components/floating-combat-text'

/**
 * Base class for all damage effects (attacks from any character to any character).
 * Subclasses declare static balance fields; construction snapshots them onto the
 * instance so balance edits only affect newly spawned attacks.
 */
export class DamageEffect extends Task {
	duration = 0
	repeat = Infinity

	minDamage = 0
	maxDamage = 0
	sound = ''
	name = ''
	eventType: CombatEventType = 'SPELL_DAMAGE'

	targetId: string = ''

	static delay = 0
	static interval = 1000
	static sound = ''
	static name = 'Generic Attack'
	static minDamage = 0
	static maxDamage = 0
	static eventType: CombatEventType = 'SPELL_DAMAGE'

	constructor(public attacker: Character) {
		super(attacker)
		applyStatics(this, 'delay', 'interval', 'sound', 'name', 'minDamage', 'maxDamage', 'eventType')
	}

	damage() {
		return randomIntFromInterval(this.minDamage, this.maxDamage)
	}

	get target() {
		return this.attacker.getTarget()
	}

	shouldTick() {
		if (this.attacker.health.current <= 0) return false
		return !!this.target
	}

	tick() {
		const target = this.target
		if (!target) return

		this.targetId = target.id
		const damage = this.damage()
		target.health.damage(damage)

		const targetName = target.name || target.constructor.name
		logCombat({
			timestamp: Date.now(),
			eventType: this.eventType,
			sourceId: this.attacker.id,
			sourceName: this.attacker.name,
			targetId: target.id,
			targetName,
			spellId: this.name,
			spellName: this.name,
			value: damage,
		})

		this.playSound()
		this.createVisualEffects(damage)

		if (target.health.current <= 0) {
			logCombat({
				timestamp: Date.now(),
				eventType: 'UNIT_DIED',
				sourceId: this.attacker.id,
				sourceName: this.attacker.name,
				targetId: target.id,
				targetName,
				spellId: this.name,
				spellName: this.name,
			})
		}
	}

	playSound() {
		if (this.sound) AudioPlayer.play(this.sound)
	}

	createVisualEffects(damageAmount: number) {
		const targetElement = document.querySelector(`.PartyMember[data-character-id="${this.targetId}"] .Character-avatar`)
		if (targetElement) this.animateHit(targetElement)

		const container = getFctContainer()
		if (!container) return
		const cssClass = `damage ${this.attacker.constructor.name.toLowerCase()}-damage`
		const fct = html`<floating-combat-text class=${cssClass}>${damageAmount}</floating-combat-text>`.toDOM()
		container.appendChild(fct)
	}

	/* Animates a DOM element to shake and flash a bit */
	animateHit(element: Element) {
		element.classList.add('is-takingDamage')
		const animation = element.animate(
			[
				{transform: 'translate(0, 0)', filter: 'none'},
				{
					transform: `translate(${randomIntFromInterval(-2, 2)}px, ${randomIntFromInterval(-2, 2)}px)`,
					filter: 'brightness(0.5)',
				},
				{transform: 'translate(0, 0)', filter: 'none'},
			],
			{duration: 200, easing: 'ease-in-out'},
		)
		animation.onfinish = () => element.classList.remove('is-takingDamage')
	}
}

/** Small, frequent attack with low damage */
export class SmallAttack extends DamageEffect {
	static interval = 1600
	static minDamage = 7
	static maxDamage = 11
	static sound = 'combat_air_hit'
	static name = 'Quick Stab'
	static eventType: CombatEventType = 'SWING_DAMAGE'
}

/** Medium attack with moderate damage and frequency */
export class MediumAttack extends DamageEffect {
	static delay = 4000
	static interval = 3800
	static minDamage = 15
	static maxDamage = 20
	static sound = 'combat_strong_punch'
	static name = 'Heavy Blow'
	static eventType: CombatEventType = 'SWING_DAMAGE'
}

/** Heavy attack with high damage but infrequent */
export class HugeAttack extends DamageEffect {
	static delay = 8000
	static interval = 12000
	static minDamage = 500
	static maxDamage = 700
	static sound = 'combat_arrow'
	static name = 'Nasty arrow'
	static eventType: CombatEventType = 'RANGE_DAMAGE'
}

/** Tank attack - lower damage but consistent */
export class TankAttack extends DamageEffect {
	static interval = 2400
	static minDamage = 16
	static maxDamage = 24
	static sound = 'combat_sword_hit'
	static name = 'Shield Bash'
	static eventType: CombatEventType = 'SWING_DAMAGE'
}
