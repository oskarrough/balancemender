import {html} from 'uhtml'
import {GameLoop} from '../nodes/game-loop'

/**
 * Time/FPS/GCD live in the Fight report panel now — this is only the god mode / infinite mana
 * indicator, which has to stay visible without opening a panel, so it renders nothing when
 * neither flag is on.
 */
export function Monitor(loop: GameLoop) {
	if (!loop.godMode && !loop.infiniteMana) return ''

	return html` <ul class="Monitor">
		${loop.godMode ? html`<li class="Monitor-godMode"><em>God mode ON</li>` : ''}
		${loop.infiniteMana ? html`<li class="Monitor-infiniteMana"><em>Inf. mana</em> ON</li>` : ''}
	</ul>`
}
