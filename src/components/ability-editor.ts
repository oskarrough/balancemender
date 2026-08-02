import {html} from 'uhtml'
import {readJournal} from '../journal'
import type {GameLoop} from '../nodes/game-loop'
import {abilityRegistry, type AbilityId} from '../nodes/registry'
import {AbilityIcon, abilityIconPath} from './ability-icon'

const PICKER_ID = 'ability-editor-picker'

/** The editable Journal bar, with ordering controls and one empty add slot. */
export function AbilityEditor(game: GameLoop) {
	const abilityIds = readJournal().abilityBar
	const catalog = Object.keys(abilityRegistry) as AbilityId[]

	return html`
		<div class="ActionBar AbilityEditor" aria-label="Ability bar editor">
			${abilityIds.map(
				(abilityId, index) => html`
					<div class="AbilityEditor-slot">
						<div class="AbilityEditor-controls">
							<button
								type="button"
								aria-label=${`Move ${abilityRegistry[abilityId].name} left`}
								title="Move left"
								.disabled=${index === 0}
								onclick=${() => game.perform({type: 'abilityMove', ability: abilityId, direction: -1})}
							>
								←
							</button>
							<button
								type="button"
								aria-label=${`Remove ${abilityRegistry[abilityId].name}`}
								title="Remove"
								onclick=${() => game.perform({type: 'abilityRemove', ability: abilityId})}
							>
								×
							</button>
							<button
								type="button"
								aria-label=${`Move ${abilityRegistry[abilityId].name} right`}
								title="Move right"
								.disabled=${index === abilityIds.length - 1}
								onclick=${() => game.perform({type: 'abilityMove', ability: abilityId, direction: 1})}
							>
								→
							</button>
						</div>
						${AbilityIcon(game, abilityId, index + 1)}
					</div>
				`,
			)}
			<button
				type="button"
				class="Plate AbilityIcon AbilityEditor-add"
				aria-label="Add ability"
				popovertarget=${PICKER_ID}
			>
				<span aria-hidden="true">＋</span>
			</button>
			<div id=${PICKER_ID} class="AbilityEditor-picker" popover="auto">
				<header>
					<strong>Add ability</strong>
					<button type="button" aria-label="Close ability picker" popovertarget=${PICKER_ID} popovertargetaction="hide">
						×
					</button>
				</header>
				<div class="AbilityEditor-catalog">
					${catalog.map((abilityId) => {
						const AbilityClass = abilityRegistry[abilityId]
						return html`<button
							type="button"
							class="Plate AbilityIcon AbilityEditor-choice"
							data-tip=${`ability:${abilityId}`}
							data-tip-at="block-end"
							.disabled=${abilityIds.includes(abilityId)}
							onclick=${(event: MouseEvent) => {
								game.perform({type: 'abilityAdd', ability: abilityId})
								const picker = (event.currentTarget as HTMLElement).closest<HTMLElement>('[popover]')
								picker?.hidePopover()
							}}
						>
							<img
								class="Plate-image"
								src=${abilityIconPath(AbilityClass)}
								alt=""
								onerror=${(event: Event) => ((event.currentTarget as HTMLImageElement).hidden = true)}
							/>
							<div class="Plate-inner"><h3>${AbilityClass.name}</h3></div>
						</button>`
					})}
				</div>
			</div>
		</div>
	`
}
