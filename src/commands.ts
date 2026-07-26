import type {GameLoop} from './nodes/game-loop'
import type {Character} from './nodes/character'
import {
	balance,
	setSpellValue,
	setAttackValue,
	setUnitValue,
	resetBalance,
	SpellKey,
	AttackKey,
	UnitKey,
} from './balance'
import {enemyRegistry, EnemyId} from './nodes/unit-registry'

function applyUnitSideEffects(game: GameLoop, name: string, key: UnitKey, value: number) {
	const all: Character[] = [...game.party, ...game.encounter.enemies]
	for (const c of all) {
		if (c.constructor.name !== name) continue
		if (key === 'maxHealth') {
			c.health.max = value
			if (c.health.current > value) c.health.current = value
		} else if (key === 'maxMana' && c.mana) {
			c.mana.max = value
			if (c.mana.current > value) c.mana.current = value
		}
	}
}

export const commands = {
	setSpell(_game: GameLoop, name: string, key: SpellKey, value: number) {
		return setSpellValue(name, key, value)
	},

	setAttack(_game: GameLoop, name: string, key: AttackKey, value: number) {
		return setAttackValue(name, key, value)
	},

	setUnit(game: GameLoop, name: string, key: UnitKey, value: number) {
		const ok = setUnitValue(name, key, value)
		if (ok) applyUnitSideEffects(game, name, key, value)
		return ok
	},

	/** Thin wrapper over the one spawn door. Returns undefined for an unknown id, as callers expect. */
	spawnEnemy(game: GameLoop, name: EnemyId): Character | undefined {
		if (!(name in enemyRegistry)) return undefined
		return game.encounter.spawn(name)
	},

	removeUnit(game: GameLoop, id: string) {
		return game.encounter.remove(id)
	},

	healParty(game: GameLoop) {
		for (const member of game.party) {
			member.health.current = member.health.max
		}
	},

	resetBalance(_game: GameLoop) {
		resetBalance()
	},

	restartEncounter(game: GameLoop) {
		game.restart()
	},
}

export {balance}
