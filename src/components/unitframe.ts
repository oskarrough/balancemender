import {Unit} from '../nodes/unit'
import {Player} from '../nodes/player'
import type {GameLoop} from '../nodes/game-loop'
import type {Aura} from '../nodes/aura'
import type {Ability} from '../nodes/ability'
import {Meter} from './bar'
import {AuraIcon} from './aura-icon'
import {html} from 'uhtml'

export function UnitFrame(unit: Unit, playerCast: Ability | undefined, player: Player) {
	const id = unit.id
	const isEnemy = unit.faction === 'enemy'
	const health = unit.health.current
	const maxHealth = unit.health.max
	const isCurrentTarget = player.intendedTarget === unit
	const displayName = unit.name || unit.constructor.name
	const target = isEnemy && isCurrentTarget ? unit.targeting?.current('enemy') : undefined
	const targetName = target ? target.name || target.constructor.name : undefined
	const auras: Aura[] = [...unit.auras]

	/**
	 * What this unit is casting. Not `playerCast` above, which is the player's own cast, passed in
	 * to preview how much of this bar it would fill. The player is skipped here because their cast
	 * bar has its own panel.
	 */
	const casting = unit === player ? undefined : unit.currentAbility
	const castElapsed = casting ? (player.root as GameLoop).elapsedTime - unit.lastCastTime : 0

	return html`
		<div
			class=${`Unit ${isEnemy ? 'Enemy' : 'PartyMember'} ${isCurrentTarget ? 'Unit--targeted' : ''} ${unit.alive ? '' : 'Unit--dead'}`}
			data-unit-id=${id}
			data-condition=${unit.condition}
			onclick=${() => (player.root as GameLoop).perform({type: 'target', unit: id})}
		>
			<div class="Unit-row">
				<figure class="Unit-avatar">${unit.image ? html`<img src=${unit.image} alt=${displayName} />` : null}</figure>
				<div class="Unit-bars">
					<div class="Unit-health">
						${Meter({
							type: 'health',
							value: health,
							max: maxHealth,
							// Only show potential healing on the current target for party members
							potentialValue:
								isCurrentTarget && !isEnemy && playerCast
									? playerCast.magnitudes.reduce((total, one) => total + one, 0)
									: 0,
							ability: !isEnemy ? playerCast : undefined,
						})}
						<div class="Unit-name">
							${displayName} ${isCurrentTarget ? '✓' : ''}${targetName ? ` → ${targetName}` : ''}
						</div>
					</div>
					${'mana' in unit && unit.mana
						? Meter({
								type: 'mana',
								value: unit.mana.current,
								max: unit.mana.max,
								potentialValue: 0,
								ability: undefined,
							})
						: null}
				</div>
			</div>
			${casting && casting.delay > 0
				? html`<div class="Unit-cast">
						<small>${casting.name}</small>
						${Meter({type: 'cast', value: castElapsed, max: casting.delay})}
					</div>`
				: null}
			${auras.length > 0
				? html`<ul class="Auras">
						${auras.map(AuraIcon)}
					</ul>`
				: null}

			<div class="FloatingCombatText"></div>
		</div>
	`
}
