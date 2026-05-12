import {html} from 'uhtml'
import {randomIntFromInterval} from '../utils'

export class FloatingCombatText extends HTMLElement {
	connectedCallback() {
		// Remove decimals
		this.textContent = String(Math.round(Number(this.textContent)))

		// Criticals
		const isCrit = Number(this.textContent) > 950
		if (isCrit) this.classList.add('crit')

		// Damage
		const isDamage = this.textContent[0] === '-'
		if (isDamage) this.classList.add('damage')

		// Put heals to the left, damage to the right
		this.style.left = `${isDamage ? randomIntFromInterval(-4, 14) : randomIntFromInterval(-10, 0)}rem`

		// Remove node once the CSS animation is done
		this.addEventListener('animationend', () => this.remove())
	}
}

export function register() {
	customElements.define('floating-combat-text', FloatingCombatText)
}

/**
 * Cached FCT container. Combat effects look this up every tick;
 * one DOM query at module init beats N per second during a fight.
 * If the UI re-mounts, we re-resolve.
 */
let fctContainer: Element | null = null
export function getFctContainer(): Element | null {
	if (!fctContainer || !fctContainer.isConnected) {
		fctContainer = document.querySelector('.FloatingCombatText')
	}
	return fctContainer
}

/**
 * Inserts a new combat text into the game
 */
export function fct(text: string | number) {
	const node = html`<floating-combat-text>${text}</floating-combat-text>`.toDOM()
	getFctContainer()?.appendChild(node)
}
