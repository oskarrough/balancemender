import {Unit} from '../nodes/unit'
import {Player} from '../nodes/player'
import type {GameLoop} from '../nodes/game-loop'
import type {PeriodicAura} from '../nodes/periodic-aura'
import {Spell} from '../nodes/spell'
import {Meter} from './bar'
import {AuraIcon} from './aura-icon'
import {html} from 'uhtml'

export function UnitFrame(unit: Unit, spell: Spell | undefined, player: Player) {
	const id = unit.id
	const isEnemy = unit.faction === 'enemy'
	const health = unit.health.current
	const maxHealth = unit.health.max
	const isCurrentTarget = player.getTarget() === unit
	const displayName = unit.name || unit.constructor.name
	const auras: PeriodicAura[] = unit.auras ? Array.from(unit.auras) : []

	/**
	 * What this unit is casting, if anything. Not the `spell` argument above — that is the
	 * *player's* cast, passed in to preview how much of this bar it would fill.
	 *
	 * Only for units other than the player, whose own cast bar has a dedicated panel under the
	 * frames. An enemy cast is otherwise invisible: the shaman's Mend takes 2500ms and says so in
	 * the combat log, but a telegraph nobody can see is not a telegraph, and it is what makes a
	 * caster something to react to rather than a health bar that refills.
	 */
	const casting = unit === player ? undefined : unit.spell
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
							potentialValue: isCurrentTarget && !isEnemy && spell ? spell.heal : 0,
							spell: !isEnemy ? spell : undefined,
						})}
						<div class="Unit-name">${displayName} ${isCurrentTarget ? '✓' : ''}</div>
					</div>
					${'mana' in unit && unit.mana
						? Meter({
								type: 'mana',
								value: unit.mana.current,
								max: unit.mana.max,
								potentialValue: 0,
								spell: undefined,
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
