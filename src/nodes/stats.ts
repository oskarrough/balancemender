export const STAT = {
	STAMINA: 'stamina',
	INTELLECT: 'intellect',
	STRENGTH: 'strength',
	AGILITY: 'agility',
	SPIRIT: 'spirit',
} as const

export type Stat = (typeof STAT)[keyof typeof STAT]
export const STAT_KEYS = Object.values(STAT)
export type StatValues = Record<Stat, number>
export const MANA_PER_INTELLECT = 15

type Modifier = {stat: Stat; amount: number}

/**
 * A unit's primary numbers. Bases describe the unit; modifiers belong to the thing temporarily
 * changing it, so removing one owner cannot accidentally undo another owner's contribution.
 */
export class Stats {
	private modifiers = new Map<object, Modifier>()

	constructor(private bases: StatValues) {}

	base(stat: Stat) {
		return this.bases[stat]
	}

	setBase(stat: Stat, value: number) {
		this.bases[stat] = value
	}

	addModifier(owner: object, stat: Stat, amount: number) {
		this.modifiers.set(owner, {stat, amount})
	}

	removeModifier(owner: object) {
		return this.modifiers.delete(owner)
	}

	resolve(stat: Stat) {
		let value = this.bases[stat]
		for (const modifier of this.modifiers.values()) {
			if (modifier.stat === stat) value += modifier.amount
		}
		return value
	}

	get stamina() {
		return this.resolve(STAT.STAMINA)
	}

	get intellect() {
		return this.resolve(STAT.INTELLECT)
	}

	get strength() {
		return this.resolve(STAT.STRENGTH)
	}

	get agility() {
		return this.resolve(STAT.AGILITY)
	}

	get spirit() {
		return this.resolve(STAT.SPIRIT)
	}

	get maxHealth() {
		return Math.max(0, this.stamina)
	}

	get maxMana() {
		return Math.max(0, this.intellect * MANA_PER_INTELLECT)
	}

	get manaRegen() {
		return Math.max(0, this.spirit)
	}
}
