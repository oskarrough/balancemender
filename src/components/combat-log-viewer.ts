import {html, formatTimestamp, render} from '../utils'
import {CombatLogEvent, combatLogs, getCombatLogs, CombatEventType} from '../combatlog'
import '../components/floating-view.js'

/** The types we allow filtering for in the UI */
export const EVENT_TYPE_FILTERS: CombatEventType[] = [
	'SPELL_CAST_START',
	'SPELL_CAST_SUCCESS',
	'SPELL_CAST_FAILED',
	'SPELL_HEAL',
	'SPELL_DAMAGE',
	'SPELL_PERIODIC_DAMAGE',
	'SPELL_PERIODIC_HEAL',
	'SWING_DAMAGE',
	'RANGE_DAMAGE',
	'SPELL_AURA_APPLIED',
	'SPELL_AURA_REFRESH',
	'SPELL_AURA_REMOVED',
	'UNIT_DIED',
]

// Verb + amount-word per event type. Defaults to "used" / value-only.
const VERBS: Partial<Record<CombatEventType, {verb: string; amountWord?: string}>> = {
	SPELL_HEAL: {verb: 'cast', amountWord: 'healed'},
	SPELL_DAMAGE: {verb: 'cast', amountWord: 'damaged for'},
	SPELL_CAST_SUCCESS: {verb: 'cast'},
	SPELL_CAST_START: {verb: 'begins casting'},
	SPELL_CAST_FAILED: {verb: 'failed to cast'},
	SPELL_AURA_APPLIED: {verb: 'applied'},
	SPELL_AURA_REFRESH: {verb: 'refreshed'},
}

function formatLogEntry(event: CombatLogEvent): string {
	if (event.eventType === 'UNIT_DIED') {
		return `${event.targetName || 'Unknown entity'} died${event.extraInfo ? ` (${event.extraInfo})` : ''}`
	}
	// Written from the target's side: nobody casts a fade, the effect simply runs out.
	if (event.eventType === 'SPELL_AURA_REMOVED') {
		return `${event.spellName} fades from ${event.targetName || 'Unknown entity'}`
	}
	const {verb = 'used', amountWord} = VERBS[event.eventType] ?? {}
	const source = event.sourceName ?? ''
	const spell = event.spellName ? ` ${verb} ${event.spellName}` : ''
	const target =
		event.targetName && event.targetName !== event.sourceName
			? ` on ${event.targetName}`
			: event.sourceName && event.eventType === 'SPELL_HEAL'
				? ' on self'
				: ''
	const amount = event.value !== undefined ? (amountWord ? ` ${amountWord} ${event.value}` : ` ${event.value}`) : ''
	const extra = event.extraInfo ? ` (${event.extraInfo})` : ''
	const aoe = event.isAOE ? ' [AOE]' : ''
	return `${source}${spell}${target}${amount}${extra}${aoe}`
}

export class CombatLogViewer extends HTMLElement {
	private currentFilter: CombatEventType | null = null
	private searchTerm = ''
	private handleLogUpdate = () => this.render()

	connectedCallback() {
		document.addEventListener('combatlog-update', this.handleLogUpdate)
		this.render()
	}

	disconnectedCallback() {
		document.removeEventListener('combatlog-update', this.handleLogUpdate)
	}

	private getFilteredLogs(): CombatLogEvent[] {
		let filtered = this.currentFilter ? getCombatLogs(this.currentFilter) : [...combatLogs]
		if (this.searchTerm) {
			const term = this.searchTerm.toLowerCase()
			filtered = filtered.filter(
				(log) =>
					log.sourceName?.toLowerCase().includes(term) ||
					log.targetName?.toLowerCase().includes(term) ||
					log.spellName?.toLowerCase().includes(term) ||
					log.extraInfo?.toLowerCase().includes(term),
			)
		}
		return filtered.sort((a, b) => b.timestamp - a.timestamp)
	}

	private setFilter = (filter: CombatEventType | null) => {
		this.currentFilter = filter
		this.render()
	}

	private handleSearch = (e: Event) => {
		this.searchTerm = (e.target as HTMLInputElement).value
		this.render()
	}

	render() {
		const filteredLogs = this.getFilteredLogs()
		const tpl = html`
			<div class="CombatLogViewer">
				<div class="CombatLogViewer-controls">
					<menu class="CombatLogViewer-filters">
						<button class=${!this.currentFilter ? 'Button active' : 'Button'} onclick=${() => this.setFilter(null)}>
							All
						</button>
						${EVENT_TYPE_FILTERS.map(
							(type) => html`
								<button
									class=${this.currentFilter === type ? 'Button active' : 'Button'}
									onclick=${() => this.setFilter(type)}
									data-event-type=${type}
								>
									${type}
								</button>
							`,
						)}
						<input
							class="CombatLogViewer-search"
							type="search"
							placeholder="Search logs..."
							value=${this.searchTerm}
							oninput=${this.handleSearch}
						/>
					</menu>
				</div>
				<div class="CombatLogViewer-content">
					${filteredLogs.length > 0
						? html`
								<ul class="CombatLogViewer-list">
									${filteredLogs.map(
										(log) => html`
											<li class="CombatLogViewer-item" data-event-type=${log.eventType}>
												<time>${formatTimestamp(log.timestamp)}</time>
												<span class="CombatLogViewer-eventType">${log.eventType}</span>
												<span class="CombatLogViewer-message"> ${formatLogEntry(log)} </span>
											</li>
										`,
									)}
								</ul>
							`
						: html`<p>No logs to display</p>`}
				</div>
			</div>
		`
		render(this, () => tpl)
	}
}

customElements.define('combat-log-viewer', CombatLogViewer)
