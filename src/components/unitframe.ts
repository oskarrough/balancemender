import {Character} from '../nodes/character'
import {Player} from '../nodes/player'
import type {GameLoop} from '../nodes/game-loop'
import type {PeriodicAura} from '../nodes/periodic-aura'
import {Spell} from '../nodes/spell'
import {Meter} from './bar'
import {AuraIcon} from './aura-icon'
import {html} from 'uhtml'

export function UnitFrame(character: Character, spell: Spell | undefined, player: Player) {
	const id = character.id
	const isEnemy = character.faction === 'enemy'
	const health = character.health.current
	const maxHealth = character.health.max
	const isCurrentTarget = player.getTarget() === character
	const displayName = character.name || character.constructor.name
	const auras: PeriodicAura[] = character.auras ? Array.from(character.auras) : []

	/**
	 * What this unit is casting, if anything. Not the `spell` argument above — that is the
	 * *player's* cast, passed in to preview how much of this bar it would fill.
	 *
	 * Only for units other than the player, whose own cast bar has a dedicated panel under the
	 * frames. An enemy cast is otherwise invisible: the shaman's Mend takes 2500ms and says so in
	 * the combat log, but a telegraph nobody can see is not a telegraph, and it is what makes a
	 * caster something to react to rather than a health bar that refills.
	 */
	const casting = character === player ? undefined : character.spell
	const castElapsed = casting ? (player.root as GameLoop).elapsedTime - character.lastCastTime : 0

	return html`
		<div
			class=${`Character ${isEnemy ? 'Enemy' : 'PartyMember'} ${isCurrentTarget ? 'Character--targeted' : ''} ${character.alive ? '' : 'Character--dead'}`}
			data-character-id=${id}
			data-condition=${character.condition}
			onclick=${() => (player.root as GameLoop).perform({type: 'target', unit: id})}
		>
			<div class="Character-row">
				<figure class="Character-avatar">
					${character.image ? html`<img src=${character.image} alt=${displayName} />` : null}
				</figure>
				<div class="Character-bars">
					<div class="Character-health">
						${Meter({
							type: 'health',
							value: health,
							max: maxHealth,
							// Only show potential healing on the current target for party members
							potentialValue: isCurrentTarget && !isEnemy && spell ? spell.heal : 0,
							spell: !isEnemy ? spell : undefined,
						})}
						<div class="Character-name">${displayName} ${isCurrentTarget ? '✓' : ''}</div>
					</div>
					${'mana' in character && character.mana
						? Meter({
								type: 'mana',
								value: character.mana.current,
								max: character.mana.max,
								potentialValue: 0,
								spell: undefined,
							})
						: null}
				</div>
			</div>
			${casting && casting.delay > 0
				? html`<div class="Character-cast">
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
