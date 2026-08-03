import {html, render} from 'uhtml'
import {GameLoop} from './nodes/game-loop'
import {UI} from './components/ui'
import {Menu} from './components/menu'
import {buildSplashIntro, buildIntro, buildLeaveGame} from './animations'
import type {DevConsole} from './components/dev-console'
import type {AnimationDebugger} from './components/animation-debugger'
import {InputManager} from './input-manager'
import {installTooltips, drawTooltip, registerTip} from './components/tooltip'
import * as perf from './perf'
import {loadFightHistory} from './fight-history'
import {dungeonOrder, dungeonRegistry, type DungeonId} from './nodes/dungeon'
import {loadJournal, readJournal, subscribeJournal} from './journal'
import {canAccessMalleable} from './access'
import {scenePaths} from './nodes/fight'
import './components/dev-console'
import './components/animation-debugger'
import {applyDefaultLayout} from './components/floating-view.js'
import './components/combat-log-viewer.js'
import './components/fight-report'
import './components/journal-view'
import './components/color-palette.js'
import './components/balance-lab'

registerTip('dungeon-lock', (dungeonId) => {
	const id = dungeonId as DungeonId
	const index = dungeonOrder.indexOf(id)
	if (index < 0) return null
	const requirements = readJournal()
		.dungeonProgression.slice(0, index)
		.filter((progress) => !progress.completed)
		.map((progress) => dungeonRegistry[progress.dungeonId].name)
	if (!requirements.length) return null

	return html`<article class="Tooltip-body">
		<h3>${dungeonRegistry[id].name}</h3>
		<p>Mend ${new Intl.ListFormat('en').format(requirements)} to unlock this dungeon.</p>
	</article>`
})

/**
 * Main entry point for the game.
 * Renders two components, the splash "menu" and the "game" itself.
 */
async function main() {
	// Panels upgrade synchronously when floating-view.js defines the element, so they have
	// their intrinsic size by now and the rails can stack them.
	applyDefaultLayout()
	installTooltips()

	// Progression must be hydrated before the splash renders its dungeon choices. Fight history is
	// supporting evidence and may load alongside it, but it never gates the menu.
	await loadJournal()
	void loadFightHistory().catch((err) => console.error('Failed to load fight history', err))

	const urlParams = new URLSearchParams(window.location.search)
	const skipSplash = urlParams.has('nosplash')
	const debugSplash = urlParams.has('debug-splash')

	// Wait for web fonts before animating the splash — otherwise "Rubik 80s Fade" swaps in mid-tween
	// and re-rasterizes the giant title, which reads as jank no matter what GSAP does.
	let splashIntro: ReturnType<typeof buildSplashIntro> | null = null
	let splashActive = !skipSplash
	let booting = false
	if (splashActive)
		void document.fonts.ready.then(() => {
			if (!splashActive) return
			// Small breather so any final layout/paint settles before the title slams in.
			setTimeout(() => {
				if (splashActive) splashIntro = buildSplashIntro()
			}, 100)
		})
	const bootGame = async (init: (game: GameLoop) => void) => {
		if (booting) return
		booting = true
		splashActive = false
		splashIntro?.kill()

		// Construct the game only now — vroum's Loop schedules `mount()` and starts ticking immediately on construction.
		const game = new GameLoop()
		init(game)
		// vroum's mount() runs in a microtask and sets running=true, so a synchronous pause()
		// here would be overwritten. Queue it so it lands after mount.
		queueMicrotask(() => game.pause())
		const element = document.querySelector('#game')
		const menuElement = document.querySelector('#menu')
		const animDebugger = document.querySelector('animation-debugger') as AnimationDebugger | null
		const input = new InputManager(game)
		let intro: ReturnType<typeof buildIntro>
		let leaving = false
		const leave = () => {
			if (leaving) return
			leaving = true
			game.pause()
			game.audio.stop()
			intro.kill()
			buildLeaveGame().eventCallback('onComplete', () => {
				input.destroy()
				game.draw = undefined
				game.disconnect()
				booting = false
				if (window.balancemender === game) delete window.balancemender
				if (element) render(element, html``)
				if (menuElement) render(menuElement, html``)
				animDebugger?.init(null)
			})
		}

		// The menu redraws with the game so its Play/Pause toggle tracks state changed elsewhere.
		game.draw = () => {
			perf.interval('frame')
			perf.measure('draw', () => {
				if (element) perf.measure('draw:ui', () => render(element, UI(game)))
				if (menuElement) perf.measure('draw:menu', () => render(menuElement, () => Menu(game, leave)))
				perf.measure('draw:tooltip', () => drawTooltip(game))
			})
		}
		setupDevTools(game)
		window.balancemender = game
		// @ts-ignore
		window.perf = perf
		if (urlParams.has('muted')) game.muted = true
		animDebugger?.init(game)

		game.render()
		// Keep the splash opaque until the selected room painting can take over the frame.
		const background = element?.querySelector<HTMLImageElement>('.Game-bg img')
		if (background) await background.decode().catch(() => undefined)
		intro = buildIntro()
		// Malleable is composed while paused. Its visible Play control is the only player input that
		// starts the clock; ordinary dungeons still begin when their intro completes.
		if (!game.malleable) intro.eventCallback('onComplete', () => game.play())
		// ?nosplash jumps the whole intro to its end state — ordinary games run on first paint, while
		// Malleable remains behind the pause queued after mount above.
		if (skipSplash) {
			intro.progress(1)
			if (!game.malleable) queueMicrotask(() => game.play())
		}
	}

	const startGame = (dungeonId: string) => bootGame((game) => game.perform({type: 'startDungeon', dungeon: dungeonId}))
	const startMalleable = () => {
		if (canAccessMalleable(readJournal())) void bootGame((game) => game.perform({type: 'enterMalleable'}))
	}
	// One step: the splash IS the dungeon list. A tap on a dungeon starts the run.
	const prompt = document.querySelector('.Splash-prompt')
	const renderDungeonChoices = () => {
		if (!prompt || skipSplash) return
		const journal = readJournal()
		render(
			prompt,
			html`<span class="Splash-dungeonsHeading">Choose your dungeon</span>
				<div class="Splash-dungeons">
					${dungeonOrder.map((dungeonId) => {
						const dungeon = dungeonRegistry[dungeonId]
						const progression = journal.dungeonProgression.find((candidate) => candidate.dungeonId === dungeon.id)
						const scene = dungeon.rooms[0]?.scene
						const painting = scene ? scenePaths(scene) : null
						return html`
							<button
								class="Button Splash-dungeon"
								type="button"
								.disabled=${!progression?.unlocked}
								data-tip=${progression?.unlocked ? null : `dungeon-lock:${dungeon.id}`}
								style=${painting
									? `--dungeon-image: url(${painting.landscape}); --dungeon-image-portrait: url(${painting.portrait})`
									: ''}
								onclick=${() => startGame(dungeon.id)}
							>
								${dungeon.name}
								<span class="Splash-dungeonRooms" aria-hidden="true">
									${dungeon.rooms.map(
										(room) => html`<span
											class="Splash-dungeonRoom"
											data-mended=${progression?.completedRoomIds.includes(room.id)}
										></span>`,
									)}
								</span>
							</button>
						`
					})}
					<button
						class="Button Button--custom"
						type="button"
						.disabled=${!canAccessMalleable(journal)}
						onclick=${startMalleable}
					>
						Create custom game
					</button>
				</div>`,
		)
	}
	renderDungeonChoices()
	subscribeJournal(renderDungeonChoices)

	if (debugSplash) {
		// Hold the splash up and hand it to the animation debugger so we can scrub the intro/outro.
		const animDebugger = document.querySelector('animation-debugger') as AnimationDebugger | null
		animDebugger?.init(null)
		return
	}

	if (skipSplash) {
		const malleable = urlParams.has('malleable')
		if (malleable && canAccessMalleable(readJournal())) startMalleable()
		else void startGame('TheGreen')
	}
}

function setupDevTools(game: GameLoop) {
	const devConsole = document.querySelector('dev-console') as DevConsole
	if (!devConsole) {
		console.error('Dev console element not found in the DOM')
		return
	}
	devConsole.init(game)
	game.console = devConsole
}

void main().catch((err) => console.error('Failed to start game', err))
