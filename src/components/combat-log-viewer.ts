import {html, formatTimestamp, render} from '../utils'
import {
	CombatLogEvent,
	combatLogs,
	getCombatLogs,
	clearLogs,
	CombatEventType,
	EVENT_TYPE_COLORS,
	EVENT_TYPE_FILTERS,
} from '../combatlog'
import '../components/floating-view.js'

/**
 * Format a combat log event for display
 */
function formatLogEntry(event: CombatLogEvent): string {
	// Get the appropriate formatter for this event type or use the default
	const formatter = EVENT_FORMATTERS.get(event.eventType) || defaultFormatter
	return formatter(event)
}

// Helper for safe string access
const safe = (value: string | undefined): string => value || ''

// Map of event type to formatter function
const EVENT_FORMATTERS = new Map<CombatEventType, (event: CombatLogEvent) => string>([
	[
		'SPELL_HEAL',
		(event) => {
			if (!event.sourceName && !event.targetName) {
				return `Healing for ${event.value || 0}${event.extraInfo ? ` (${event.extraInfo})` : ''}`
			}

			const source = safe(event.sourceName)
			const spell = event.spellName ? ` cast ${event.spellName}` : ''
			const target =
				event.targetName && event.targetName !== event.sourceName
					? ` on ${event.targetName}`
					: event.sourceName
						? ' on self'
						: ''
			const amount = event.value !== undefined ? ` healed for ${event.value}` : ''
			const extra = event.extraInfo ? ` (${event.extraInfo})` : ''

			return `${source}${spell}${target}${amount}${extra}`
		},
	],

	[
		'SPELL_DAMAGE',
		(event) => {
			const source = safe(event.sourceName)
			const spell = event.spellName ? ` cast ${event.spellName}` : ''
			const target = event.targetName ? ` on ${event.targetName}` : ''
			const amount = event.value !== undefined ? ` damaged for ${event.value}` : ''
			const extra = event.extraInfo ? ` (${event.extraInfo})` : ''
			const aoe = event.isAOE ? ' [AOE]' : ''

			return `${source}${spell}${target}${amount}${extra}${aoe}`
		},
	],

	[
		'SPELL_CAST_SUCCESS',
		(event) => {
			const source = safe(event.sourceName)
			const spell = event.spellName ? ` cast ${event.spellName}` : ' cast unknown spell'
			const target =
				event.targetName && event.targetName !== event.sourceName
					? ` on ${event.targetName}`
					: ''
			const extra = event.extraInfo ? ` (${event.extraInfo})` : ''

			return `${source}${spell}${target}${extra}`
		},
	],

	[
		'SPELL_CAST_START',
		(event) => {
			const source = safe(event.sourceName)
			const spell = event.spellName
				? ` begins casting ${event.spellName}`
				: ' begins casting'
			const target =
				event.targetName && event.targetName !== event.sourceName
					? ` on ${event.targetName}`
					: ''
			const extra = event.extraInfo ? ` (${event.extraInfo})` : ''

			return `${source}${spell}${target}${extra}`
		},
	],

	[
		'SPELL_CAST_FAILED',
		(event) => {
			const source = safe(event.sourceName)
			const spell = event.spellName
				? ` failed to cast ${event.spellName}`
				: ' failed to cast'
			const reason = event.extraInfo ? ` (${event.extraInfo})` : ''

			return `${source}${spell}${reason}`
		},
	],

	[
		'UNIT_DIED',
		(event) => {
			return `${event.targetName || 'Unknown entity'} died${event.extraInfo ? ` (${event.extraInfo})` : ''}`
		},
	],
])

// Default formatter for any event type not explicitly handled
const defaultFormatter = (event: CombatLogEvent): string => {
	const source = safe(event.sourceName)
	const action = event.spellName ? ` used ${event.spellName}` : ''
	const target =
		event.targetName && event.targetName !== event.sourceName
			? ` on ${event.targetName}`
			: ''
	const value = event.value !== undefined ? ` ${event.value}` : ''
	const extra = event.extraInfo ? ` (${event.extraInfo})` : ''

	return `${source}${action}${target}${value}${extra}`
}

function getEventColor(eventType: CombatEventType): string {
	return EVENT_TYPE_COLORS[eventType] || '#666666'
}

/**
 * CombatLogViewer component as a custom element
 */
export class CombatLogViewer extends HTMLElement {
	private currentFilter: CombatEventType | null = null
	private searchTerm = ''

	// Store event handler as a bound method to use same reference for add/remove
	private handleLogUpdate = () => this.render()

	constructor() {
		super()
	}

	connectedCallback() {
		// Add event listener for log updates
		document.addEventListener('combatlog-update', this.handleLogUpdate)
		this.render()
	}

	disconnectedCallback() {
		// Remove event listener properly with the same function reference
		document.removeEventListener('combatlog-update', this.handleLogUpdate)
	}

	/**
	 * Filter logs based on current filter and search term
	 */
	private getFilteredLogs(): CombatLogEvent[] {
		let filtered = this.currentFilter
			? getCombatLogs(this.currentFilter)
			: [...combatLogs]

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

		// Return most recent logs first
		return filtered.sort((a, b) => b.timestamp - a.timestamp)
	}

	private setFilter = (filter: CombatEventType | null) => {
		this.currentFilter = filter
		this.render()
	}

	private handleSearch = (e: Event) => {
		const input = e.target as HTMLInputElement
		this.searchTerm = input.value
		this.render()
	}

	private handleClear = () => {
		clearLogs()
		this.currentFilter = null
		this.searchTerm = ''
		this.render()
	}

	render() {
		const filteredLogs = this.getFilteredLogs()

		// Controls that will go in the main content area
		const controlsTemplate = html`
			<div class="CombatLogViewer-controls">
				<menu class="CombatLogViewer-filters">
					<button
						class=${!this.currentFilter ? 'Button active' : 'Button'}
						onclick=${() => this.setFilter(null)}
					>
						All
					</button>
					${EVENT_TYPE_FILTERS.map(
						(type) => html`
							<button
								class=${this.currentFilter === type ? 'Button active' : 'Button'}
								onclick=${() => this.setFilter(type)}
								style=${`color: ${getEventColor(type)}`}
							>
								${type.replace('SPELL_', '')}
							</button>
						`,
					)}
				</menu>

				<input
					class="CombatLogViewer-search"
					type="text"
					placeholder="Search logs..."
					value=${this.searchTerm}
					oninput=${this.handleSearch}
				/>

				<button hidden class="Button" onclick=${this.handleClear}>Clear</button>
			</div>
		`

		const tpl = html`
			<div class="CombatLogViewer">
				${controlsTemplate}
				<div class="CombatLogViewer-content">
					${filteredLogs.length > 0
						? html`
								<ul class="CombatLogViewer-list">
									${filteredLogs.map(
										(log) => html`
											<li class="CombatLogViewer-item" data-event-type=${log.eventType}>
												<small class="CombatLogViewer-timestamp"
													>${formatTimestamp(log.timestamp)}</small
												>
												<strong
													class="CombatLogViewer-eventType"
													style=${`color: ${getEventColor(log.eventType)}`}
												>
													${log.eventType}
												</strong>
												<span class="CombatLogViewer-message">
													${formatLogEntry(log)}
												</span>
											</li>
										`,
									)}
								</ul>
							`
						: html`<div class="CombatLogViewer-empty">No logs to display</div>`}
				</div>
			</div>
		`
		render(this, () => tpl)
	}
}

// Register the web component
customElements.define('combat-log-viewer', CombatLogViewer)
