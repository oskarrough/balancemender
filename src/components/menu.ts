import {html} from 'uhtml'
import {log} from '../utils'
import {GameLoop} from '../nodes/game-loop'
import {Boss} from '../nodes/boss'
import {Tank} from '../nodes/tank'
import {AudioPlayer} from '../nodes/audio'
import gsap from 'gsap'

export function Menu(game: GameLoop) {
	const start = () => animatedStartGame(game)

	const toggleMuted = (event: Event) => {
		const checkbox = event.target as HTMLInputElement

		// Use the AudioPlayer to toggle sound and sync with game
		log('menu: toggling sound state')

		// Update game muted state - this will sync with AudioPlayer through the setter
		game.muted = !checkbox.checked

		// Log state for debugging
		log(`menu: sound is now ${game.muted ? 'off' : 'on'}`)

		// Make sure checkbox reflects current state
		checkbox.checked = !game.muted
	}

	return html`
		<div class="IngameMenu">
			<nav>
				<a class="Spell Button" type="button" href="/">Reset</a>
				<button class="Spell Button" type="button" onclick=${() => game.play()}>
					Play</button
				><button class="Spell Button" type="button" onclick=${() => game.pause()}>
					Pause</button
				><label class="Spell Button SoundToggle"
					><input type="checkbox" onchange=${toggleMuted} ?checked=${!game.muted} /> Sound
				</label>
			</nav>
			<!-- Hidden developer menu - commented out for now -->
			<!-- 
			<nav hidden>
				<button class="Spell Button" type="button">
					Add tank
				</button>
				<button class="Spell Button" type="button">
					Add boss
				</button>
			</nav>
			-->
		</div>
	`
}

export function animatedStartGame(game: GameLoop, timeScale = 1) {
	log('animating new game start')

	// Stop the game.
	// game.disconnect()
	game.gameOver = false

	// Animate the splash+menu out, and game elements in.
	const tl = gsap
		.timeline({
			paused: true,
			onComplete: () => {
				log('animating new game start: onComplete')
				game.play()
			},
		})
		.to('.Menu, .Frame-splashImage', {autoAlpha: 0, duration: 0.5})
		.to('.IngameMenu', {opacity: 1, duration: 0.5}, '<')
		.to('.Frame-game', {opacity: 1, duration: 0.5}, '>-0.1')
		.to('.Game-bg', {opacity: 0.2, duration: 0.5}, '<')
		.fromTo(
			'.ActionBar',
			{y: 100, autoAlpha: 0},
			{y: 0, autoAlpha: 1, duration: 0.7},
			'<',
		)
		.fromTo('.Player', {y: 40, autoAlpha: 0}, {y: 0, autoAlpha: 1, duration: 0.6}, '<0.3')
		.fromTo(
			'.PartyGroup',
			{y: 20, autoAlpha: 0},
			{y: 0, autoAlpha: 1, duration: 0.5},
			'<0.2',
		)
		.fromTo(
			'.Enemies',
			{x: 100, autoAlpha: 0},
			{x: 0, autoAlpha: 1, duration: 1},
			'<-0.1',
		)
	tl.timeScale(timeScale)
	tl.play()
}
