import gsap from 'gsap'
import type {GameLoop} from './nodes/game-loop'

export interface NamedAnimation {
	name: string
	/** Set up DOM/game state so the animation has something to animate (debugger previews use this). */
	prepare?: (game: GameLoop) => void
	build: (game: GameLoop) => gsap.core.Timeline
}

/** Intro sequence. Pure — assumes the game UI is already rendered. */
export function buildStartGame(_game: GameLoop): gsap.core.Timeline {
	const tl = gsap.timeline()
	tl.fromTo('.Frame', {autoAlpha: 0}, {autoAlpha: 1, duration: 0.5})
	tl.fromTo('.IngameMenu', {autoAlpha: 0}, {autoAlpha: 1, duration: 0.5}, '<')
	tl.fromTo('.Frame-game', {autoAlpha: 0}, {autoAlpha: 1, duration: 0.5}, '>-0.1')
	tl.fromTo('.ActionBar', {y: 100, autoAlpha: 0}, {y: 0, autoAlpha: 1, duration: 0.7}, '<')
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
	tl.fromTo('.Frame-game', {x: 0}, {keyframes: {x: [-10, 10, -7, 7, -3, 3, 0]}, duration: 0.5, ease: 'power2.out'}, '<')
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
	const tl = gsap.timeline({onComplete: () => game.play()})
	const ease = 'power2.in'
	tl.to('.GameOver', {autoAlpha: 0, duration: 0.4, ease})
	tl.to('.ActionBar', {y: 80, autoAlpha: 0, scale: 0.95, duration: 0.4, ease}, '<')
	tl.to('.Enemies, .PartyGroup', {y: -30, autoAlpha: 0, scale: 0.95, duration: 0.4, ease}, '<')
	tl.call(() => game.restart())
	tl.add(buildStartGame(game))
	return tl
}

export const animations: NamedAnimation[] = [
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
