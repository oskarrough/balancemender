import {html} from 'uhtml'
import type {GameLoop} from '../nodes/game-loop'
import {unitRegistry, type UnitId} from '../nodes/unit-registry'
import {FACTION, type Faction} from '../nodes/types'

const unitIds = (Object.keys(unitRegistry) as UnitId[]).filter((unit) => unit !== 'Player')

function addPicker(game: GameLoop, side: Faction) {
	const add = (event: SubmitEvent) => {
		event.preventDefault()
		const form = event.currentTarget as HTMLFormElement
		const data = new FormData(form)
		const unit = data.get('unit') as UnitId
		const count = Math.min(99, Math.max(1, Math.floor(Number(data.get('count')) || 1)))
		for (let index = 0; index < count; index++) game.perform({type: 'customRoomAdd', side, unit})
	}

	return html`
		<details class="RoomEditor-picker">
			<summary class="Button" aria-label=${`Add a unit to the ${side}`}>＋</summary>
			<form onsubmit=${add}>
				<select name="unit" aria-label="Unit type">
					${unitIds.map((unit) => html`<option value=${unit}>${unit}</option>`)}
				</select>
				<input name="count" type="number" min="1" max="99" value="1" aria-label="Count" />
				<button class="Button" type="submit">Add</button>
			</form>
		</details>
	`
}

function roster(game: GameLoop, side: Faction) {
	const units = side === FACTION.PARTY ? game.party : game.enemies
	return html`
		<section class="RoomEditor-side" data-side=${side}>
			<header>
				<strong>${side === FACTION.PARTY ? 'Party' : 'Enemies'}</strong>
				${addPicker(game, side)}
			</header>
			<ul>
				${units.map(
					(unit) => html`
						<li>
							<span>${unit.name}</span>
							${unit === game.player
								? html`<small>fixed</small>`
								: html`<button
										class="RoomEditor-remove"
										type="button"
										aria-label=${`Remove ${unit.name}`}
										onclick=${() => game.perform({type: 'customRoomRemove', unit: unit.id})}
									>
										×
									</button>`}
						</li>
					`,
				)}
			</ul>
		</section>
	`
}

export function RoomEditor(game: GameLoop) {
	return html`
		<aside class="RoomEditor" aria-label="Room composition">
			${roster(game, FACTION.PARTY)} ${roster(game, FACTION.ENEMY)}
		</aside>
	`
}
