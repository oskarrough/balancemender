import {html, render} from 'uhtml'
import {formatFightTime} from '../utils'
import {CombatLogEvent, combatEvents, CombatEventType} from '../combatlog'
import {currentGame} from '../nodes/game-loop'
import {unitRegistry, type UnitId} from '../nodes/unit-registry'
import type {Unit} from '../nodes/unit'
import {FACTION} from '../nodes/types'
import {viewedFight, fightHistoryEvents} from '../fight-history'
import '../components/floating-view.js'

type LogGroup = 'casts' | 'damage' | 'healing' | 'auras' | 'units' | 'fight'

/**
 * What every event type is, in the panel's own words: the group whose chip switches it on, and the
 * short label a row shows in place of `SPELL_PERIODIC_DAMAGE` — 21 characters of a 60ch panel.
 *
 * `satisfies` over the whole union on purpose. This used to be a hand-kept list of the types worth
 * filtering, which drifted both ways: it offered `SPELL_CAST_FAILED`, which nothing logs, and had no
 * entry for the interrupts, absorbs and mana spends that fill a real fight. Now a new event type
 * fails the build here rather than quietly arriving in the log unfilterable.
 */
const EVENT_META = {
	SPELL_CAST_START: {group: 'casts', label: 'casting'},
	SPELL_CAST_SUCCESS: {group: 'casts', label: 'cast'},
	SPELL_CAST_FAILED: {group: 'casts', label: 'failed'},
	SPELL_CAST_INTERRUPTED: {group: 'casts', label: 'stopped'},
	SWEET_SPOT_HIT: {group: 'casts', label: 'sweet'},
	SWEET_SPOT_MISS: {group: 'casts', label: 'no sweet'},
	RESOURCE_GAIN: {group: 'casts', label: 'mana +'},
	RESOURCE_SPENT: {group: 'casts', label: 'mana −'},
	SPELL_DAMAGE: {group: 'damage', label: 'damage'},
	SPELL_PERIODIC_DAMAGE: {group: 'damage', label: 'dmg tick'},
	SWING_DAMAGE: {group: 'damage', label: 'swing'},
	RANGE_DAMAGE: {group: 'damage', label: 'shot'},
	SPELL_ABSORBED: {group: 'damage', label: 'absorbed'},
	SPELL_HEAL: {group: 'healing', label: 'heal'},
	SPELL_PERIODIC_HEAL: {group: 'healing', label: 'heal tick'},
	SPELL_AURA_APPLIED: {group: 'auras', label: 'aura on'},
	SPELL_AURA_REFRESH: {group: 'auras', label: 'aura +'},
	SPELL_AURA_REMOVED: {group: 'auras', label: 'aura off'},
	UNIT_DIED: {group: 'units', label: 'down'},
	UNIT_CONDITION: {group: 'units', label: 'condition'},
	FIGHT_START: {group: 'fight', label: 'fight on'},
	FIGHT_END: {group: 'fight', label: 'fight end'},
	GAME_PAUSE: {group: 'fight', label: 'pause'},
	GAME_RESUME: {group: 'fight', label: 'resume'},
} satisfies Record<CombatEventType, {group: LogGroup; label: string}>

/**
 * Chip order. Only the groups this log actually contains get a chip, so a quiet fight shows three —
 * plus any group switched on, which has to stay clickable when a new fight empties it out.
 */
const GROUP_ORDER: LogGroup[] = ['casts', 'damage', 'healing', 'auras', 'units', 'fight']

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

/**
 * Nothing dies in the player's hands — see docs/universe.md. An enemy at zero settles, a party
 * member falls, a boss gets the whole sentence. The code keeps `alive`, `kill` and `UNIT_DIED`.
 */
function deathPhrase(event: CombatLogEvent): string {
	const name = event.targetName || 'Unknown unit'
	const unit = event.targetId ? unitsInView().find((candidate) => candidate.id === event.targetId) : undefined
	if (unit?.faction === FACTION.PARTY) return `${name} falls`
	const Klass = unit?.unitId && (unitRegistry[unit.unitId] as unknown as typeof Unit)
	if (Klass && Klass.boss) return `The fever breaks. ${name} breathes evenly for the first time.`
	return `${name} settles`
}

/** Who is on screen: a stored fight's recorded roster, or the running fight's units. */
function unitsInView(): readonly {id: string; faction: string; unitId?: UnitId}[] {
	return viewedFight()?.units ?? currentGame()?.fight.units ?? []
}

function formatLogEntry(event: CombatLogEvent): string {
	if (event.eventType === 'UNIT_DIED') {
		return `${deathPhrase(event)}${event.extraInfo ? ` (${event.extraInfo})` : ''}`
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
	/** Groups switched on. Empty is "all" — nothing to clear before the first click. */
	private groups = new Set<LogGroup>()
	/** One exact type, from clicking a row's label. Beats `groups` while it is set. */
	private exactType: CombatEventType | null = null
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

	/**
	 * Everything the search matches, newest first. The chips count over this rather than over the
	 * whole log, so a chip's number is what clicking it would actually show.
	 */
	private searched(): CombatLogEvent[] {
		// A stored fight selected in the Fight report replaces the live log wholesale. Copied
		// before reversing — the stored events are a cached array someone else reads too.
		let events = [...(viewedFight()?.events ?? currentGame()?.combatLog.events ?? [])]
		if (this.searchTerm) {
			const term = this.searchTerm.toLowerCase()
			events = events.filter(
				(log) =>
					log.sourceName?.toLowerCase().includes(term) ||
					log.targetName?.toLowerCase().includes(term) ||
					log.abilityName?.toLowerCase().includes(term) ||
					log.castId?.toLowerCase().includes(term) ||
					log.extraInfo?.toLowerCase().includes(term),
			)
		}
		// `add()` only ever pushes, so the log is already in fight order — newest first is a
		// reverse. It used to sort on `timestamp`, which is wall clock: a slow frame or a paused
		// tab stretches those gaps, and two events in one millisecond ordered arbitrarily.
		return events.reverse()
	}

	private matchesFilter(log: CombatLogEvent) {
		if (this.exactType) return log.eventType === this.exactType
		if (!this.groups.size) return true
		return this.groups.has(EVENT_META[log.eventType].group)
	}

	/** Toggling a group drops the exact type — the two are one filter, at two zoom levels. */
	private toggleGroup = (group: LogGroup) => {
		this.exactType = null
		if (this.groups.has(group)) this.groups.delete(group)
		else this.groups.add(group)
		this.render()
	}

	private clearFilter = () => {
		this.groups.clear()
		this.exactType = null
		this.render()
	}

	/** A row's label is its own filter. One listener on the list, not one per row. */
	private handleListClick = (event: Event) => {
		const label = (event.target as HTMLElement).closest('.CombatLogViewer-type')
		const type = label?.parentElement?.dataset.eventType as CombatEventType | undefined
		if (!type) return
		this.groups.clear()
		this.exactType = this.exactType === type ? null : type
		this.render()
	}

	private handleSearch = (e: Event) => {
		this.searchTerm = (e.target as HTMLInputElement).value
		this.render()
	}

	render() {
		const searched = this.searched()
		const counts = new Map<LogGroup, number>()
		for (const log of searched) {
			const {group} = EVENT_META[log.eventType]
			counts.set(group, (counts.get(group) ?? 0) + 1)
		}
		const filtered = searched.filter((log) => this.matchesFilter(log))
		const seeked = this.seekTime === null ? null : nearest(filtered, this.seekTime)
		const filtering = this.exactType !== null || this.groups.size > 0
		const tpl = html`
			<div class="CombatLogViewer">
				<div class="CombatLogViewer-controls">
					<menu class="CombatLogViewer-filters">
						<button class="CombatLogViewer-chip" aria-pressed=${!filtering} onclick=${this.clearFilter}>
							all <b>${searched.length}</b>
						</button>
						${GROUP_ORDER.filter((group) => counts.has(group) || this.groups.has(group)).map(
							(group) => html`
								<button
									class="CombatLogViewer-chip"
									aria-pressed=${this.groups.has(group)}
									onclick=${() => this.toggleGroup(group)}
								>
									${group} <b>${counts.get(group) ?? 0}</b>
								</button>
							`,
						)}
						${this.exactType
							? html`
									<button
										class="CombatLogViewer-chip"
										aria-pressed="true"
										data-event-type=${this.exactType}
										onclick=${this.clearFilter}
									>
										${EVENT_META[this.exactType].label} <b>${filtered.length}</b> ✕
									</button>
								`
							: ''}
					</menu>
					<input
						class="CombatLogViewer-search"
						type="search"
						placeholder="Search…"
						value=${this.searchTerm}
						oninput=${this.handleSearch}
					/>
					${viewedFight() ? html`<span class="CombatLogViewer-viewing">past fight</span>` : ''}
				</div>
				<div class="CombatLogViewer-content">
					${filtered.length > 0
						? html`
								<ul class="CombatLogViewer-list" onclick=${this.handleListClick}>
									${filtered.map(
										(log) => html`
											<li class="CombatLogViewer-item" data-event-type=${log.eventType} ?data-seeked=${log === seeked}>
												<time>${formatFightTime(log.time ?? 0)}</time>
												<button class="CombatLogViewer-type" title=${`Only ${log.eventType}`}>
													${EVENT_META[log.eventType].label}
												</button>
												<span class="CombatLogViewer-message">${formatLogEntry(log)}</span>
											</li>
										`,
									)}
								</ul>
							`
						: html`<p class="CombatLogViewer-empty">Nothing here${filtering ? ' — try another filter' : ''}</p>`}
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
