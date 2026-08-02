import {html} from 'uhtml'
import {readJournal} from '../journal'
import type {GameLoop} from '../nodes/game-loop'
import type {AbilityClass} from '../nodes/ability'
import {abilityRegistry, type AbilityId} from '../nodes/registry'
import {AbilityIcon, abilityIconPath} from './ability-icon'

const PICKER_ID = 'ability-editor-picker'
const PICKER_TITLE_ID = 'ability-editor-picker-title'

type CatalogEntry = {id: AbilityId; ability: AbilityClass}
type CatalogGroup = {label: string; entries: CatalogEntry[]}

const groupDefinitions: readonly {label: string; matches: (ability: AbilityClass) => boolean}[] = [
	{label: 'Healing', matches: (ability) => ability.tags.includes('healing')},
	{label: 'Attacks', matches: (ability) => ability.tags.includes('attack')},
	{label: 'Other spells', matches: (ability) => ability.tags.includes('spell')},
]

function catalogGroups(): CatalogGroup[] {
	const entries = (Object.keys(abilityRegistry) as AbilityId[]).map((id) => ({id, ability: abilityRegistry[id]}))
	let remaining = entries
	const groups = groupDefinitions.map(({label, matches}) => {
		const groupEntries = remaining
			.filter(({ability}) => matches(ability))
			.sort((a, b) => a.ability.name.localeCompare(b.ability.name))
		remaining = remaining.filter(({ability}) => !matches(ability))
		return {label, entries: groupEntries}
	})
	remaining.sort((a, b) => a.ability.name.localeCompare(b.ability.name))
	if (remaining.length) groups.push({label: 'Other abilities', entries: remaining})
	return groups.filter(({entries: groupEntries}) => groupEntries.length > 0)
}

/** The editable Journal bar, with ordering controls and one empty add slot. */
export function AbilityEditor(game: GameLoop) {
	const abilityIds = readJournal().abilityBar
	const catalog = catalogGroups()

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
			<div
				id=${PICKER_ID}
				class="Panel AbilityEditor-picker"
				role="dialog"
				aria-labelledby=${PICKER_TITLE_ID}
				popover="auto"
			>
				<header>
					<strong id=${PICKER_TITLE_ID}>Add ability</strong>
					<button type="button" aria-label="Close ability picker" popovertarget=${PICKER_ID} popovertargetaction="hide">
						×
					</button>
				</header>
				<main class="AbilityEditor-catalog">
					${catalog.map(
						({label, entries}) => html`
							<section class="AbilityEditor-group">
								<h3>${label}</h3>
								<div class="AbilityEditor-groupChoices">
									${entries.map(({id: abilityId, ability: AbilityClass}) => {
										const assigned = abilityIds.includes(abilityId)
										return html`<button
											type="button"
											class="Plate AbilityIcon AbilityEditor-choice"
											data-tip=${`ability:${abilityId}`}
											data-tip-at="block-end"
											data-assigned=${assigned}
											aria-disabled=${assigned ? 'true' : 'false'}
											onclick=${(event: MouseEvent) => {
												if (assigned) return
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
							</section>
						`,
					)}
				</main>
			</div>
		</div>
	`
}
