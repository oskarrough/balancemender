import {html} from '../utils'
import type {PeriodicEffect} from '../nodes/periodic'

export function EffectIcon(effect: PeriodicEffect) {
	return html`
		<div class="Spell">
			<div class="Spell-inner">
				<h3>${effect.name}</h3>
				<span> <span class="spin">⏲</span> ${effect._cycles}/${effect.repeat} </span>
			</div>
		</div>
	`
}
