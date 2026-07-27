import {html} from 'uhtml'
import {randomIntFromInterval} from '../utils'

export class FloatingCombatText extends HTMLElement {
	connectedCallback() {
		// Remove decimals
		this.textContent = String(Math.round(Number(this.textContent)))

		// Damage
		const isDamage = this.textContent[0] === '-'
		if (isDamage) this.classList.add('damage')

		// Put heals to the left, damage to the right, jittered so equal numbers don't stack
		this.style.left = `${isDamage ? randomIntFromInterval(8, 14) : randomIntFromInterval(1, 7)}rem`

		// Remove node once the CSS animation is done
		this.addEventListener('animationend', () => this.remove())
	}
}

export function register() {
	customElements.define('floating-combat-text', FloatingCombatText)
}

/**
 * One FCT container per unit frame, cached by unit id — hits land many times a second
 * and each would otherwise cost a DOM query. uhtml patches the frames in place, so a cached
 * container survives re-renders; it only goes stale when the frame leaves the DOM (a unit
 * died, the encounter reloaded), which `isConnected` catches.
 */
const containers = new Map<string, Element>()

function containerFor(unitId: string) {
	const cached = containers.get(unitId)
	if (cached?.isConnected) return cached
	const container = document.querySelector(`[data-unit-id="${unitId}"] .FloatingCombatText`)
	if (container) containers.set(unitId, container)
	else containers.delete(unitId)
	return container
}

/**
 * Floats a number over the frame of the unit it happened to.
 */
export function fct(unitId: string, text: string | number) {
	const container = containerFor(unitId)
	if (!container) return
	container.appendChild(html`<floating-combat-text>${text}</floating-combat-text>`.toDOM())
}
