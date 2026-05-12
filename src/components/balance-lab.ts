import {html, render} from '../utils'
import type {GameLoop} from '../nodes/game-loop'
import {allInspectables, Inspectable, InspectableSection} from '../inspectables'
import {BalanceInspector} from './balance-inspector'
import './balance-inspector'

declare global {
	interface Window {
		balancemender?: GameLoop
	}
}

export class BalanceLab extends HTMLElement {
	private selectedId: string | null = 'globals'
	private _onLogUpdate = () => this.refreshInspector()
	private _retryTimer: number | null = null

	private get game(): GameLoop | undefined {
		return window.balancemender
	}

	select(id: string) {
		this.selectedId = id
		this.render()
	}

	connectedCallback() {
		document.addEventListener('combatlog-update', this._onLogUpdate)
		this.render()
		if (!this.game) {
			// Game isn't constructed yet (splash). Poll briefly until it appears.
			this._retryTimer = window.setInterval(() => {
				if (this.game) {
					if (this._retryTimer) window.clearInterval(this._retryTimer)
					this._retryTimer = null
					this.render()
				}
			}, 250)
		}
	}

	disconnectedCallback() {
		document.removeEventListener('combatlog-update', this._onLogUpdate)
		if (this._retryTimer) {
			window.clearInterval(this._retryTimer)
			this._retryTimer = null
		}
	}

	private sections(): InspectableSection[] {
		const game = this.game
		if (!game) return []
		return allInspectables(game)
	}

	private findSelected(sections: InspectableSection[]): Inspectable | null {
		for (const s of sections) {
			const found = s.items.find((i) => i.id === this.selectedId)
			if (found) return found
		}
		return null
	}

	/** Re-pull the live data into the inspector without rebuilding the nav. */
	private refreshInspector() {
		const sections = this.sections()
		const selected = this.findSelected(sections)
		const insp = this.querySelector('balance-inspector') as BalanceInspector | null
		insp?.setTarget(selected)
	}

	render() {
		if (!this.game) {
			render(this, () => html`<p>Waiting for game…</p>`)
			return
		}
		const sections = this.sections()
		const selected = this.findSelected(sections)

		render(
			this,
			() => html`
				<nav class="BalanceLab-nav">
					${sections.map(
						(sec) => html`
							<details open>
								<summary>${sec.section}</summary>
								<ul>
									${sec.items.map(
										(item) => html`
											<li>
												<button
													class=${`BalanceLab-pick ${item.id === this.selectedId ? 'is-active' : ''}`}
													onclick=${() => this.select(item.id)}
												>
													<span class="BalanceLab-pickTitle">${item.title}</span>
													${item.subtitle ? html`<small>${item.subtitle}</small>` : ''}
												</button>
											</li>
										`,
									)}
								</ul>
							</details>
						`,
					)}
				</nav>
				<balance-inspector class="BalanceLab-inspector"></balance-inspector>
			`,
		)

		const insp = this.querySelector('balance-inspector') as BalanceInspector | null
		insp?.setTarget(selected)
	}
}

customElements.define('balance-lab', BalanceLab)
