import {html} from '../utils'
import type {PeriodicAura} from '../nodes/periodic-aura'

export function AuraIcon(aura: PeriodicAura) {
	return html`
		<div class="Spell">
			<div class="Spell-inner">
				<h3>${aura.name}</h3>
				<span> <span class="spin">⏲</span> ${aura._cycles}/${aura.repeat} </span>
			</div>
		</div>
	`
}
