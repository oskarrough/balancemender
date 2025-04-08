import {html, roundOne} from '../utils'
import {GameLoop} from '../nodes/game-loop'

export function Monitor(loop: GameLoop) {
	const player = loop.player
	const fps = loop.deltaTime > 0 ? Math.round(1000 / loop.deltaTime) : 0

	return html` <ul class="Log Monitor">
		<li><em>Time</em> ${roundOne(loop.elapsedTime / 1000)}s</li>
		<li><em>FPS</em> ${fps}</li>
		<li><em>GCD</em> ${player.gcd ? 'on' : 'off'}</li>
		${loop.godMode ? html`<li class="Monitor-godMode"><em>God mode ON</li>` : ''}
		${loop.infiniteMana ? html`<li class="Monitor-infiniteMana"><em>Inf. mana</em> ON</li>` : ''}
	</ul>`
}
