import {html, render} from 'uhtml'
import {formatTimestamp} from '../utils'
import {CombatLogEvent, combatEvents, CombatEventType} from '../combatlog'
import {currentGame} from '../nodes/game-loop'
import {viewedFight, fightHistoryEvents} from '../fight-history'
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
	'UNIT_CONDITION',
]

/** Reads as a state the unit is now in, not as something the source did to them. */
const CONDITION_PHRASE = {
	injured: 'is injured',
	steady: 'is out of danger',
	healthy: 'is healthy again',
}

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
		return `${event.targetName || 'Unknown unit'} died${event.extraInfo ? ` (${event.extraInfo})` : ''}`
	}
	if (event.eventType === 'UNIT_CONDITION' && event.condition) {
		return `${event.targetName || 'Unknown unit'} ${CONDITION_PHRASE[event.condition]}`
	}
	// Written from the target's side: nobody casts a fade, the aura simply runs out.
	if (event.eventType === 'SPELL_AURA_REMOVED') {
		return `${event.abilityName} fades from ${event.targetName || 'Unknown unit'}`
	}
	const {verb = 'used', amountWord} = VERBS[event.eventType] ?? {}
	const source = event.sourceName ?? ''
	const spell = event.abilityName ? ` ${verb} ${event.abilityName}` : ''
	const target =
		event.targetName && event.targetName !== event.sourceName
			? ` on ${event.targetName}`
			: event.sourceName && event.eventType === 'SPELL_HEAL'
				? ' on self'
				: ''
	const amount = event.value !== undefined ? (amountWord ? ` ${amountWord} ${event.value}` : ` ${event.value}`) : ''
	const extra = event.extraInfo ? ` (${event.extraInfo})` : ''
	return `${source}${spell}${target}${amount}${extra}`
}

export class CombatLogViewer extends HTMLElement {
	private currentFilter: CombatEventType | null = null
	private searchTerm = ''
	/** Live events don't touch a stored fight's view — skip the redraw while one is up. */
	private handleLogUpdate = () => !viewedFight() && this.render()
	private handleHistoryChange = () => this.render()
	/** Fight time the report's scrub cursor points at — the nearest event gets highlighted. */
	private seekTime: number | null = null
	private handleSeek = (event: Event) => {
		this.seekTime = (event as CustomEvent<number>).detail
		this.render()
		this.querySelector('[data-seeked]')?.scrollIntoView({block: 'center'})
	}

	connectedCallback() {
		combatEvents.addEventListener('combatlog-update', this.handleLogUpdate)
		combatEvents.addEventListener('combatlog-seek', this.handleSeek)
		fightHistoryEvents.addEventListener('change', this.handleHistoryChange)
		this.render()
	}

	disconnectedCallback() {
		combatEvents.removeEventListener('combatlog-update', this.handleLogUpdate)
		combatEvents.removeEventListener('combatlog-seek', this.handleSeek)
		fightHistoryEvents.removeEventListener('change', this.handleHistoryChange)
	}

	private getFilteredLogs(): CombatLogEvent[] {
		// A stored fight selected in the Fight report replaces the live log wholesale. Copied
		// before sorting — the stored events are a cached array someone else reads too.
		let filtered = [...(viewedFight()?.events ?? currentGame()?.combatLog.events ?? [])]
		if (this.currentFilter) filtered = filtered.filter((log) => log.eventType === this.currentFilter)
		if (this.searchTerm) {
			const term = this.searchTerm.toLowerCase()
			filtered = filtered.filter(
				(log) =>
					log.sourceName?.toLowerCase().includes(term) ||
					log.targetName?.toLowerCase().includes(term) ||
					log.abilityName?.toLowerCase().includes(term) ||
					log.castId?.toLowerCase().includes(term) ||
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
		const seeked = this.seekTime === null ? null : nearest(filteredLogs, this.seekTime)
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
					${viewedFight() ? html`<span class="CombatLogViewer-viewing">past fight</span>` : ''}
				</div>
				<div class="CombatLogViewer-content">
					${filteredLogs.length > 0
						? html`
								<ul class="CombatLogViewer-list">
									${filteredLogs.map(
										(log) => html`
											<li class="CombatLogViewer-item" data-event-type=${log.eventType} ?data-seeked=${log === seeked}>
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

/** The event closest in fight time to the seeked moment — where the report's cursor points. */
function nearest(logs: CombatLogEvent[], time: number) {
	let best: CombatLogEvent | null = null
	for (const log of logs) {
		if (log.time === undefined) continue
		if (!best || Math.abs(log.time - time) < Math.abs((best.time ?? 0) - time)) best = log
	}
	return best
}

customElements.define('combat-log-viewer', CombatLogViewer)
