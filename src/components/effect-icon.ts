import {html} from '../utils'
import {HOT} from '../nodes/hot'

export function EffectIcon(effect: HOT) {
	return html`
		<div class="Spell">
			<div class="Spell-inner">
				<h3>${effect.name}</h3>
				<span><span class="spin">⏲</span> ${effect.cycles}/${effect.repeat}</span>
			</div>
		</div>
	`
}
