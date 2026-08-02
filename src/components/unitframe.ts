import {Unit} from '../nodes/unit'
import {Player} from '../nodes/player'
import type {GameLoop} from '../nodes/game-loop'
import type {Aura} from '../nodes/aura'
import {BarrierAura} from '../nodes/barrier-aura'
import type {Ability} from '../nodes/ability'
import {Meter} from './bar'
import {AuraIcon} from './aura-icon'
import {html} from 'uhtml'

export function UnitFrame(unit: Unit, playerCast: Ability | undefined, player: Player) {
	const id = unit.id
	const isEnemy = unit.faction === 'enemy'
	const health = unit.health.current
	const maxHealth = unit.health.max
	const isSelectedTarget = player.selectedTarget === unit
	const isIntendedTarget = player.intendedTarget === unit
	const displayName = unit.name || unit.constructor.name
	const target = isEnemy && isIntendedTarget ? unit.targeting?.current('enemy') : undefined
	const targetName = target ? target.name || target.constructor.name : undefined
	const auras: Aura[] = [...unit.auras]
	// Barriers stack, and the bar cares about the total rather than which spell left it.
	const absorb = auras.reduce((total, aura) => total + (aura instanceof BarrierAura ? aura.pool : 0), 0)
	/* Stacks are separate copies on the unit, which as separate chips would say three Nettles where
	   the fight has one at three. The last copy is drawn — it has the longest left to run. */
	const auraStacks = new Map<string, Aura[]>()
	for (const aura of auras) {
		const group = auraStacks.get(aura.stackKey)
		if (group) group.push(aura)
		else auraStacks.set(aura.stackKey, [aura])
	}

	/* What this unit is casting — not `playerCast`, which is the player's own, passed in to preview
	   how much of this bar it would fill. The player is skipped: their cast bar has its own panel. */
	const casting = unit === player ? undefined : unit.currentAbility
	const castElapsed = casting ? (player.root as GameLoop).elapsedTime - unit.lastCastTime : 0

	return html`
		<div
			class=${`Unit ${isEnemy ? 'Enemy' : 'PartyMember'} ${unit === player ? 'Unit--player' : ''} ${isSelectedTarget ? 'Unit--targeted' : ''} ${unit.alive ? '' : 'Unit--dead'}`}
			data-unit-id=${id}
			data-condition=${unit.condition}
		>
			<button
				type="button"
				class="Unit-target"
				aria-pressed=${isSelectedTarget}
				aria-label=${displayName}
				onclick=${() => (player.root as GameLoop).perform({type: 'target', unit: id})}
			></button>
			<div class="Unit-row">
				<figure class="Unit-avatar">${unit.image ? html`<img src=${unit.image} alt=${displayName} />` : null}</figure>
				<div class="Unit-bars">
					<div class="Unit-health">
						${Meter({
							type: 'health',
							value: health,
							max: maxHealth,
							// Preview healing where the current cast would land, even when it is the fallback target.
							potentialValue:
								isIntendedTarget && !isEnemy && playerCast
									? playerCast.magnitudes.reduce((total, one) => total + one, 0)
									: 0,
							absorbValue: absorb,
							ability: !isEnemy ? playerCast : undefined,
						})}
						<!-- No target tick: the frame's own gold edge already says which unit is selected. -->
						<div class="Unit-name">
							<b>${displayName}</b>${targetName ? html`<small>→ ${targetName}</small>` : null}
						</div>
					</div>
					${'mana' in unit && unit.mana
						? Meter({
								type: 'mana',
								value: unit.mana.current,
								max: unit.mana.max,
								/* Only your own pool carries its numbers and its rate. On anyone else mana is
								   context, and `shouldTick` is the five-second rule itself rather than a copy of it. */
								regen:
									unit === player ? {rate: unit.mana.regen.regenRate, active: unit.mana.regen.shouldTick()} : undefined,
							})
						: null}
				</div>
			</div>
			<!-- Rendered only when there is something to show; Unit-hang keeps them out of the frame's flow. -->
			<div class="Unit-hang">
				${casting && casting.delay > 0
					? html`<div class="Unit-cast">
							<small>${casting.name}</small>
							${Meter({type: 'cast', value: castElapsed, max: casting.delay})}
						</div>`
					: null}
				${auraStacks.size > 0
					? html`<ul class="Auras">
							${[...auraStacks.values()].map((group) => AuraIcon(group[group.length - 1], group.length))}
						</ul>`
					: null}
			</div>

			<div class="FloatingCombatText"></div>
		</div>
	`
}
