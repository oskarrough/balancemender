import {html} from '../utils'
import type {Aura} from '../nodes/aura'

export function AuraIcon(aura: Aura) {
	return html`
		<div class="Spell">
			<div class="Spell-inner">
				<h3>${aura.name}</h3>
				<span> <span class="spin">⏲</span> ${aura._cycles}/${aura.repeat} </span>
			</div>
		</div>
	`
}
