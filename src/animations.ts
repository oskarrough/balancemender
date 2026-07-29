import gsap from 'gsap'
import type {GameLoop} from './nodes/game-loop'

export interface NamedAnimation {
	name: string
	/** Set up DOM/game state so the animation has something to animate (debugger previews use this). */
	prepare?: (game: GameLoop) => void
	build: (game: GameLoop) => gsap.core.Timeline
}

let splashPromptPulse: gsap.core.Tween | null = null

/** Splash entrance. Slams the title in, then loops a pulse on the prompt until the outro kills it. */
export function buildSplashIntro(): gsap.core.Timeline {
	const tl = gsap.timeline()
	tl.fromTo(
		'.Splash-titleLine',
		{opacity: 0.001, scale: 1.8, y: -40, rotation: -4},
		{
			opacity: 1,
			scale: 1,
			y: 0,
			rotation: 0,
			duration: 0.7,
			stagger: 0.35,
			ease: 'back.out(1.8)',
		},
	)
	tl.fromTo('.Splash-subtitle', {autoAlpha: 0, y: 20}, {autoAlpha: 1, y: 0, duration: 0.6, ease: 'power2.out'}, '>0.05')
	tl.fromTo('.Splash-prompt', {autoAlpha: 0}, {autoAlpha: 1, duration: 0.5}, '>-0.1')
	tl.call(() => {
		splashPromptPulse?.kill()
		splashPromptPulse = gsap.to('.Splash-prompt', {
			autoAlpha: 0.3,
			duration: 0.7,
			repeat: -1,
			yoyo: true,
			ease: 'sine.inOut',
		})
	})
	return tl
}

/** Splash exit. Flashes the prompt, punches the title out, fades the overlay. */
export function buildSplashOutro(): gsap.core.Timeline {
	const tl = gsap.timeline({
		onStart: () => {
			splashPromptPulse?.kill()
			splashPromptPulse = null
		},
	})
	tl.set('.Splash-prompt', {autoAlpha: 1})
	tl.to('.Splash-prompt', {autoAlpha: 0, duration: 0.06, repeat: 5, yoyo: true})
	tl.to('.Splash-title', {scale: 1.25, autoAlpha: 0, duration: 0.35, ease: 'power2.in'})
	tl.to('.Splash-subtitle, .Splash-prompt', {autoAlpha: 0, y: -20, duration: 0.25, ease: 'power2.in'}, '<')
	tl.to('.Splash', {autoAlpha: 0, duration: 0.3, ease: 'power2.in'}, '>-0.1')
	tl.set('.Splash', {display: 'none'})
	return tl
}

/** Full intro: splash outro → game intro, scrubbable as one timeline. */
export function buildIntro(game: GameLoop): gsap.core.Timeline {
	const tl = gsap.timeline()
	tl.add(buildSplashOutro())
	tl.add(buildStartGame(game), '>-0.3')
	return tl
}

/** Intro sequence. Pure — assumes the game UI is already rendered. */
export function buildStartGame(_game: GameLoop): gsap.core.Timeline {
	const tl = gsap.timeline()
	tl.fromTo('.AppChrome', {autoAlpha: 0}, {autoAlpha: 1, duration: 0.5})
	tl.fromTo('.IngameMenu', {autoAlpha: 0}, {autoAlpha: 1, duration: 0.5}, '<')
	tl.fromTo('.AppChrome-game', {autoAlpha: 0}, {autoAlpha: 1, duration: 0.5}, '>-0.1')
	// A percentage rather than a pixel distance, so the bar keeps sliding exactly its own height in from below however tall the icons get.
	tl.fromTo('.ActionBar', {y: '100%', autoAlpha: 0}, {y: 0, autoAlpha: 1, duration: 0.7}, '<')
	tl.fromTo('.PartyGroup', {y: 20, autoAlpha: 0}, {y: 0, autoAlpha: 1, duration: 0.5}, '<0.2')
	tl.fromTo('.Enemies', {x: 100, autoAlpha: 0}, {x: 0, autoAlpha: 1, duration: 1}, '<-0.1')
	return tl
}

/** Game-over flourish. Pure — assumes `gameOver` is already true and the `.GameOver` element is rendered. */
export function buildGameOver(_game: GameLoop): gsap.core.Timeline {
	const tl = gsap.timeline()
	tl.fromTo(
		'.Enemies, .PartyGroup',
		{scale: 1, filter: 'saturate(1)'},
		{scale: 0.9, filter: 'saturate(0.2)', duration: 0.7, ease: 'power3.out'},
	)
	tl.fromTo(
		'.AppChrome-game',
		{x: 0},
		{keyframes: {x: [-10, 10, -7, 7, -3, 3, 0]}, duration: 0.5, ease: 'power2.out'},
		'<',
	)
	tl.fromTo(
		'.GameOver',
		{autoAlpha: 0, scale: 0.3, y: -60, rotation: -4},
		{autoAlpha: 1, scale: 1, y: 0, rotation: 0, duration: 0.7, ease: 'back.out(2.2)'},
		'<0.15',
	)
	tl.fromTo(
		'.GameOver > *',
		{autoAlpha: 0, y: 14},
		{autoAlpha: 1, y: 0, duration: 0.35, stagger: 0.08, ease: 'power2.out'},
		'<0.25',
	)
	return tl
}

/**
 * Game-over → fresh encounter transition, composed into a single scrubbable timeline:
 * fade-out → state reset (mid-timeline `.call`) → intro.
 */
export function restartGame(game: GameLoop): gsap.core.Timeline {
	const animatedGame = '.AppChrome-game, .ActionBar, .Enemies, .PartyGroup'
	const clearAnimationState = () => {
		// Reset GSAP's transform cache as well as the CSS. Clearing the property alone lets a later
		// y-only intro tween compose itself with the cached game-over scale.
		gsap.set(animatedGame, {x: 0, y: 0, scale: 1, filter: 'none', autoAlpha: 1})
		gsap.set(animatedGame, {clearProps: 'transform,filter,opacity,visibility'})
	}
	const tl = gsap.timeline({
		onComplete: () => {
			// The intro is built while the game-over styles still exist, so its tweens can cache those
			// old transforms. Clean once more after its final frame, when nothing can reapply them.
			clearAnimationState()
			game.play()
		},
	})
	const ease = 'power2.in'
	tl.to('.GameOver', {autoAlpha: 0, duration: 0.4, ease})
	tl.to('.ActionBar', {y: '100%', autoAlpha: 0, scale: 0.95, duration: 0.4, ease}, '<')
	tl.to('.Enemies, .PartyGroup', {y: -30, autoAlpha: 0, scale: 0.95, duration: 0.4, ease}, '<')
	tl.call(() => {
		game.restart()
		// Game-over and fade-out tweens leave inline transforms and filters behind. Clear them at
		// the state boundary: the filter greys out the fresh frames, while even a zero transform on
		// `.AppChrome-game` creates a stacking context over the fixed menu and intercepts its clicks.
		clearAnimationState()
	})
	tl.add(buildStartGame(game))
	return tl
}

const resetSplashForPreview = () => {
	splashPromptPulse?.kill()
	splashPromptPulse = null
	gsap.set('.Splash', {clearProps: 'all'})
	gsap.set('.Splash-bg, .Splash-title, .Splash-titleLine, .Splash-subtitle, .Splash-prompt', {
		clearProps: 'all',
	})
}

export const animations: NamedAnimation[] = [
	{
		name: 'Splash intro',
		prepare: resetSplashForPreview,
		build: () => buildSplashIntro(),
	},
	{
		name: 'Splash outro',
		prepare: () => {
			resetSplashForPreview()
			// Put the splash in its "fully visible" idle state so the outro has something to remove.
			buildSplashIntro().progress(1).kill()
		},
		build: () => buildSplashOutro(),
	},
	{
		name: 'New game',
		prepare: (game) => {
			game.gameOver = false
			game.render()
		},
		build: buildStartGame,
	},
	{
		name: 'Game over',
		prepare: (game) => {
			game.gameOver = true
			game.render()
		},
		build: buildGameOver,
	},
	{
		name: 'Restart (fade + intro)',
		prepare: (game) => {
			game.gameOver = true
			game.render()
		},
		build: restartGame,
	},
]
