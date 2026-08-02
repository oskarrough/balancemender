import {html, render} from 'uhtml'
import {currentGame, type GameLoop} from '../nodes/game-loop'
import {combatEvents} from '../combatlog'
import {allInspectables, Inspectable, InspectableSection} from '../inspectables'
import {BalanceInspector} from './balance-inspector'
import './balance-inspector'
import {getMalleableOverride, setMalleableOverride} from '../access'

export class BalanceLab extends HTMLElement {
	private selectedId: string | null = 'globals'
	private _onLogUpdate = () => this.refreshInspector()
	private _retryTimer: number | null = null

	private get game(): GameLoop | undefined {
		return currentGame()
	}

	select(id: string) {
		this.selectedId = id
		this.render()
	}

	connectedCallback() {
		combatEvents.addEventListener('combatlog-update', this._onLogUpdate)
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
		combatEvents.removeEventListener('combatlog-update', this._onLogUpdate)
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

	private findSelected(sections: InspectableSection[]): Inspectable | InspectableSection | null {
		for (const s of sections) {
			if (`section:${s.section}` === this.selectedId) return s
			const found = s.items.find((i) => i.id === this.selectedId)
			if (found) return found
		}
		return null
	}

	/** The one number that identifies an item at a glance — its first tunable. */
	private hint(item: Inspectable): string {
		const field = item.fields.find((f) => f.kind === 'number')
		return field ? String(field.get()) : ''
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
				<label class="BalanceLab-malleable">
					<input
						type="checkbox"
						.checked=${getMalleableOverride()}
						onchange=${(event: Event) => setMalleableOverride((event.target as HTMLInputElement).checked)}
					/>
					Malleable override
				</label>
				<nav class="BalanceLab-nav">
					${sections.map(
						(sec) => html`
							<details open>
								<summary
									class=${`section:${sec.section}` === this.selectedId ? 'is-active' : ''}
									onclick=${(e: Event) => {
										// Selecting a section shouldn't also collapse it — the triangle still toggles.
										if (!(e.target as Element).closest('.BalanceLab-toggle')) {
											e.preventDefault()
											this.select(`section:${sec.section}`)
										}
									}}
								>
									<span class="BalanceLab-toggle"></span>
									${sec.section} ${sec.items.length > 1 ? html`<small>· ${sec.items.length}</small>` : ''}
								</summary>
								<ul>
									${sec.items.map(
										(item) => html`
											<li>
												<button
													class=${`BalanceLab-pick ${item.id === this.selectedId ? 'is-active' : ''}`}
													onclick=${() => this.select(item.id)}
												>
													<span class="BalanceLab-pickTitle">${item.title}</span>
													<span class="BalanceLab-pickHint">${this.hint(item)}</span>
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
