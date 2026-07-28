import {randomIntFromInterval} from '../utils'

/**
 * `src/nodes/hit.ts` imports `fct` from here, so this file has to load in a simulation, where
 * there is no DOM at all — hence no uhtml (it wants one the moment it loads) and the element
 * class declared in here rather than at the top level (`extends HTMLElement` is evaluated where
 * it is written). Called once, from `ui.ts`.
 */
export function register() {
	class FloatingCombatText extends HTMLElement {
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
	// `applyHit` calls this on every hit, and a simulation has no document to float anything over.
	if (typeof document === 'undefined') return
	const cached = containers.get(unitId)
	if (cached?.isConnected) return cached
	const container = document.querySelector(`[data-unit-id="${unitId}"] .FloatingCombatText`)
	if (container) containers.set(unitId, container)
	else containers.delete(unitId)
	return container
}

/** Floats a number over the frame of the unit it happened to. */
export function fct(unitId: string, text: string | number) {
	const container = containerFor(unitId)
	if (!container) return
	const element = document.createElement('floating-combat-text')
	element.textContent = String(text)
	container.appendChild(element)
}
