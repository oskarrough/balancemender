import {html, formatTimestamp} from '../utils'
import {
	CombatLogEvent,
	combatLogs,
	getCombatLogs,
	clearLogs,
	CombatEventType,
	EVENT_TYPE_COLORS,
	EVENT_TYPE_FILTERS,
} from '../combatlog'

// Current state
let currentFilter: CombatEventType | null = null
let searchTerm = ''
let isExpanded = false

/**
 * Format a combat log event for display
 */
function formatLogEntry(event: CombatLogEvent): string {
	const parts: string[] = []

	if (event.sourceName) {
		parts.push(event.sourceName)

		if (event.spellName) {
			parts.push(`cast ${event.spellName}`)
		}

		if (event.targetName && event.targetName !== event.sourceName) {
			parts.push(`on ${event.targetName}`)
		}
	} else if (event.targetName) {
		parts.push(event.targetName)
	}

	if (event.value !== undefined) {
		if (event.eventType === 'SPELL_HEAL') {
			parts.push(`healed for ${event.value}`)
		} else if (event.eventType === 'SPELL_DAMAGE') {
			parts.push(`damaged for ${event.value}`)
		} else {
			parts.push(event.value.toString())
		}
	}

	if (event.extraInfo) {
		parts.push(`(${event.extraInfo})`)
	}

	return parts.join(' ')
}

function getEventColor(eventType: CombatEventType): string {
	return EVENT_TYPE_COLORS[eventType] || '#666666'
}

/**
 * Filter logs based on current filter and search term
 */
function getFilteredLogs(): CombatLogEvent[] {
	let filtered = currentFilter ? getCombatLogs(currentFilter) : [...combatLogs]

	if (searchTerm) {
		const term = searchTerm.toLowerCase()
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

/**
 * CombatLogViewer component renders a filterable view of combat logs
 */
export function CombatLogViewer() {
	const filteredLogs = getFilteredLogs()

	function toggleExpand() {
		isExpanded = !isExpanded
	}

	function setFilter(filter: CombatEventType | null) {
		currentFilter = filter
	}

	function handleSearch(e: Event) {
		const input = e.target as HTMLInputElement
		searchTerm = input.value
	}

	function handleClear() {
		clearLogs()
		currentFilter = null
		searchTerm = ''
	}

	return html`
		<div class=${`CombatLogViewer${isExpanded ? ' is-expanded' : ''}`}>
			<header class="CombatLogViewer-header">
				<h3 class="CombatLogViewer-title" onclick=${toggleExpand}>
					Combat Log (${filteredLogs.length})
					<button class="CombatLogViewer-expandBtn">${isExpanded ? '▼' : '▲'}</button>
				</h3>

				<div class="CombatLogViewer-controls">
					<div class="CombatLogViewer-filters">
						<button
							class=${!currentFilter ? 'Button active' : 'Button'}
							onclick=${() => setFilter(null)}
						>
							All
						</button>
						${EVENT_TYPE_FILTERS.map(
							(type) => html`
								<button
									class=${currentFilter === type ? 'Button active' : 'Button'}
									onclick=${() => setFilter(type)}
									style=${`color: ${getEventColor(type)}`}
								>
									${type.replace('SPELL_', '')}
								</button>
							`,
						)}
					</div>

					<div class="CombatLogViewer-search">
						<input
							type="text"
							placeholder="Search logs..."
							value=${searchTerm}
							oninput=${handleSearch}
						/>
					</div>

					<button class="Button clear" onclick=${handleClear}>Clear</button>
				</div>
			</header>

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
												${log.eventType.replace('SPELL_', '')}
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
}

// Function to add a new log entry to the viewer
export function addLogToViewer(event: CombatLogEvent) {
	// Re-render triggered by the event listener in logCombat function
	// No implementation needed here as it's handled via state management
}

// Register the component with our custom element registry
export function registerCombatLogViewer() {
	// Placeholder for future web component registration
}
