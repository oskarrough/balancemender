import {Character} from '../nodes/character'
import {Player} from '../nodes/player'
import {HOT} from '../nodes/hot'
import {Spell} from '../nodes/spell'
import {Meter} from './bar'
import {EffectIcon} from './effect-icon'
import {html} from 'uhtml'

export function UnitFrame(
	character: Character,
	spell: Spell | undefined,
	player: Player,
) {
	const id = character.id
	const isEnemy = character.faction === 'enemy'
	const health = character.health.current
	const maxHealth = character.health.max
	const isCurrentTarget = player.currentTarget === character
	const displayName = character.name || character.constructor.name
	const effects: HOT[] = character.effects ? Array.from(character.effects) : []

	return html`
		<div
			class=${`Character ${isEnemy ? 'Enemy' : 'PartyMember'} ${isCurrentTarget ? 'Character--targeted' : ''}`}
			data-character-id=${id}
			onclick=${() => {
				player.currentTarget = character
			}}
		>
			<div class="Character-avatar">${displayName} ${isCurrentTarget ? '✓' : ''}</div>

			${Meter({
				type: 'health',
				value: health,
				max: maxHealth,
				// Only show potential healing on the current target for party members
				potentialValue: isCurrentTarget && !isEnemy && spell ? spell.heal : 0,
				spell: !isEnemy ? spell : undefined,
			})}
			${'mana' in character && character.mana
				? Meter({
						type: 'mana',
						value: character.mana.current,
						max: character.mana.max,
						potentialValue: 0,
						spell: undefined,
					})
				: null}
			${effects.length > 0
				? html`<ul class="Effects">
						${effects.map(EffectIcon)}
					</ul>`
				: null}

			<div class="FloatingCombatText"></div>
		</div>
	`
}
