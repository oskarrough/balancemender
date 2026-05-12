import {GameLoop} from '../nodes/game-loop'
import {animations, NamedAnimation, restartGame} from '../animations'

type Timeline = ReturnType<NamedAnimation['build']>

/**
 * Floating panel to play with GSAP timelines without reloading.
 * Pick an animation from the dropdown, then Restart/Play/Pause/Reverse/seek.
 * To register a new animation, add an entry to `src/animations.ts`.
 */
class AnimationDebugger extends HTMLElement {
	private game!: GameLoop
	private tl: Timeline | null = null
	private rafId = 0
	private selectedIndex = 0
	private select!: HTMLSelectElement
	private progress!: HTMLInputElement
	private timeScale!: HTMLInputElement
	private timeScaleLabel!: HTMLSpanElement
	private status!: HTMLSpanElement

	init(game: GameLoop) {
		this.game = game
		this.render()
	}

	connectedCallback() {
		if (!this.firstChild) this.render()
	}

	disconnectedCallback() {
		cancelAnimationFrame(this.rafId)
	}

	private render() {
		const options = animations.map((a, i) => `<option value="${i}">${a.name}</option>`).join('')
		this.innerHTML = `
			<div class="AnimationDebugger">
				<div class="AnimationDebugger-row">
					<button class="Button" data-game="gameover">Trigger game over</button>
					<button class="Button" data-game="restart">Restart game</button>
				</div>
				<div class="AnimationDebugger-row">
					<select data-select>${options}</select>
					<span class="AnimationDebugger-status" data-status>idle</span>
				</div>
				<div class="AnimationDebugger-row">
					<button class="Button" data-action="restart">Restart</button>
					<button class="Button" data-action="play">Play</button>
					<button class="Button" data-action="pause">Pause</button>
					<button class="Button" data-action="reverse">Reverse</button>
				</div>
				<label class="AnimationDebugger-row">
					<span style="min-width: 4.5rem">Speed <span data-time-scale-label>1.0×</span></span>
					<input type="range" min="0.1" max="4" step="0.1" value="1" data-time-scale />
				</label>
				<label class="AnimationDebugger-row">
					<span style="min-width: 4.5rem">Seek</span>
					<input type="range" min="0" max="1" step="0.001" value="0" data-progress />
				</label>
			</div>
		`

		this.select = this.querySelector('[data-select]') as HTMLSelectElement
		this.progress = this.querySelector('[data-progress]') as HTMLInputElement
		this.timeScale = this.querySelector('[data-time-scale]') as HTMLInputElement
		this.timeScaleLabel = this.querySelector('[data-time-scale-label]') as HTMLSpanElement
		this.status = this.querySelector('[data-status]') as HTMLSpanElement

		this.select.addEventListener('change', () => {
			this.selectedIndex = parseInt(this.select.value)
			this.setStatus('idle')
		})
		this.querySelectorAll('button[data-action]').forEach((btn) => {
			btn.addEventListener('click', () => this.handleAction((btn as HTMLButtonElement).dataset.action!))
		})
		this.querySelectorAll('button[data-game]').forEach((btn) => {
			btn.addEventListener('click', () => this.handleGameAction((btn as HTMLButtonElement).dataset.game!))
		})
		this.timeScale.addEventListener('input', () => {
			const v = parseFloat(this.timeScale.value)
			this.timeScaleLabel.textContent = `${v.toFixed(1)}×`
			if (this.tl) this.tl.timeScale(v)
		})
		this.progress.addEventListener('input', () => {
			if (!this.tl) return
			this.tl.pause()
			this.tl.progress(parseFloat(this.progress.value))
			this.setStatus('scrub')
		})
	}

	private handleGameAction(action: string) {
		if (action === 'gameover') {
			this.game.onGameOver()
			this.setStatus('triggered game over')
		} else if (action === 'restart') {
			this.tl = restartGame(this.game)
			this.tl.timeScale(parseFloat(this.timeScale.value))
			this.setStatus('restarting')
			this.startTracking()
		}
	}

	private handleAction(action: string) {
		if (action === 'restart') {
			this.buildTimeline()
			return
		}
		if (!this.tl) this.buildTimeline()
		if (!this.tl) return
		if (action === 'play') this.tl.play()
		else if (action === 'pause') this.tl.pause()
		else if (action === 'reverse') this.tl.reverse()
		this.setStatus(action)
	}

	private buildTimeline() {
		this.game.pause()
		if (this.tl) this.tl.kill()
		const anim = animations[this.selectedIndex]
		anim.prepare?.(this.game)
		this.tl = anim.build(this.game)
		this.tl.timeScale(parseFloat(this.timeScale.value))
		const prevOnComplete = this.tl.eventCallback('onComplete')
		this.tl.eventCallback('onComplete', () => {
			prevOnComplete?.()
			this.setStatus('complete')
		})
		this.setStatus('playing')
		this.startTracking()
	}

	private startTracking() {
		cancelAnimationFrame(this.rafId)
		const tick = () => {
			if (this.tl && document.activeElement !== this.progress) {
				this.progress.value = String(this.tl.progress())
			}
			this.rafId = requestAnimationFrame(tick)
		}
		tick()
	}

	private setStatus(text: string) {
		this.status.textContent = text
	}
}

customElements.define('animation-debugger', AnimationDebugger)

export {AnimationDebugger}
