import {html} from 'uhtml'
import {formatFightLocation} from '../fight-location'
import type {StoredFightMeta} from '../fight-history'
import {deathOf, percentOf as percent} from '../sim/format'
import type {CastStats, FightReport, Series} from '../sim/report'

export function historySelect({
	fights,
	selected,
	onSelect,
}: {
	fights: StoredFightMeta[]
	selected: string | null
	onSelect: (id: string | null) => void
}) {
	if (!fights.length) return ''
	return html`
		<select
			class="FightReport-history"
			data-outcome=${fights.find((fight) => fight.id === selected)?.outcome ?? 'live'}
			onchange=${(event: Event) => {
				const value = (event.target as HTMLSelectElement).value
				onSelect(value === 'live' ? null : value)
			}}
		>
			<option value="live" ?selected=${selected === null}>Live</option>
			${fights.map((fight) => historyOption(fight, selected))}
		</select>
	`
}

function historyOption(fight: StoredFightMeta, selected: string | null) {
	const date = new Date(fight.timestamp)
	const when = date.toLocaleString(undefined, {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'})
	const location = formatFightLocation(fight.location)
	return html`
		<option value=${fight.id} ?selected=${selected === fight.id}>
			${location ? `${location} · ` : ''}${fight.outcome} · ${(fight.duration / 1000).toFixed(1)}s · ${when}
		</option>
	`
}

export function fightSummary({
	report,
	duration,
	live,
}: {
	report: FightReport
	duration: number
	live: {fps: number; gcd: boolean} | null
}) {
	const location = formatFightLocation(report.location)
	return html`
		${location ? html`<p class="FightReport-location">${location}</p>` : ''}
		<p class="FightReport-summary">
			<strong class="FightReport-stat" data-stat="duration">${(duration / 1000).toFixed(1)}s</strong> ·
			<span class="FightReport-stat" data-stat="events">${report.events} events</span> ·
			<span class="FightReport-stat" data-stat="rate">${report.totals.hps} hps</span> ·
			<span class="FightReport-stat" data-stat="rate">${report.totals.dps} dps</span> ·
			<span class="FightReport-stat" data-stat="overheal"
				>${percent(report.totals.overhealing, report.totals.overhealing + report.totals.healing)} overheal</span
			>
			${live
				? html` · <span class="FightReport-stat" data-stat="fps">${live.fps} fps</span> ·
						<span class="FightReport-stat" data-stat="gcd">gcd ${live.gcd ? 'on' : 'off'}</span>`
				: ''}
		</p>
	`
}

export function healthTimeline({
	report,
	cursor,
	scrubTime,
	onScrub,
}: {
	report: FightReport
	cursor: number | null
	scrubTime: number | null
	onScrub: ((time: number) => void) | null
}) {
	return html`
		<ul class="FightReport-units">
			${report.health.map((unit) => healthRow(unit, report, cursor, onScrub))}
			${onScrub ? scrubber(report, scrubTime, onScrub) : ''}
		</ul>
	`
}

function scrubber(report: FightReport, scrubTime: number | null, onScrub: (time: number) => void) {
	const value = scrubTime ?? report.duration
	return html`
		<li class="FightReport-scrub">
			<span></span>
			<input
				type="range"
				min="0"
				max=${Math.round(report.duration)}
				step="any"
				aria-label="Scrub the fight timeline"
				.value=${String(value)}
				oninput=${(event: Event) => onScrub(Number((event.target as HTMLInputElement).value))}
			/>
			<span class="FightReport-unitHealth">${(value / 1000).toFixed(1)}s</span>
		</li>
	`
}

function healthRow(unit: Series, report: FightReport, cursor: number | null, onScrub: ((time: number) => void) | null) {
	const death = report.deaths.find((candidate) => deathOf(candidate, unit))
	const column = cursor === null ? -1 : Math.min(unit.points.length - 1, Math.floor(cursor * unit.points.length))
	const ratio = cursor === null ? unit.endHealth / unit.maxHealth : unit.points[column]
	// An enemy settles, a party member falls — the code keeps `alive`. See docs/universe.md.
	const verb = unit.faction === 'party' ? 'fell' : 'settled'
	const label =
		cursor === null && death
			? `${verb} ${(death.time / 1000).toFixed(1)}s`
			: ratio > 0
				? `${Math.round(ratio * 100)}%`
				: verb
	const deadAt = death ? Math.min(1, death.time / report.duration) : null
	return html`
		<li class="FightReport-unit" data-faction=${unit.faction}>
			<span class="FightReport-unitName">${unit.name}</span>
			${healthGraph(
				unit.points,
				cursor,
				deadAt,
				onScrub && ((fraction: number) => onScrub(fraction * report.duration)),
			)}
			<span class="FightReport-unitHealth">${label}</span>
		</li>
	`
}

export function unitStatsTable(report: FightReport) {
	// `absorb`/`wasted` reads like `heal`/`overheal`: the amount, then the share of the pool that
	// did nothing. A barrier that expired untouched and one that soaked a killing blow are the
	// same number without it. Only drawn when something shielded — the table is already wider
	// than the panel, and most fights have no barrier in them at all.
	const shielded = report.units.some((unit) => unit.absorbed > 0 || unit.wasted > 0)
	return html`
		<table class="FightReport-table" style=${`--columns: ${shielded ? 9 : 7}`}>
			<thead>
				<tr>
					<th>unit</th>
					<th>casts</th>
					<th>dmg</th>
					<th>heal</th>
					<th>overheal</th>
					${shielded ? html`<th>absorb</th>` : ''} ${shielded ? html`<th>wasted</th>` : ''}
					<th>taken</th>
					<th>busy</th>
					<th>hurt</th>
				</tr>
			</thead>
			<tbody>
				${report.units.map(
					(unit) => html`
						<tr>
							<td>${unit.name}</td>
							<td>${unit.casts}</td>
							<td>${unit.damageDone}</td>
							<td>${unit.healingDone}</td>
							<td>${percent(unit.overhealing, unit.healingDone + unit.overhealing)}</td>
							${shielded ? html`<td>${unit.absorbed}</td>` : ''}
							${shielded ? html`<td>${percent(unit.wasted, unit.absorbed + unit.wasted)}</td>` : ''}
							<td>${unit.damageTaken}</td>
							<!-- Share of the fight spent committed to a cast or its global cooldown. -->
							<td>${percent(unit.busyTime, report.duration)}</td>
							<!-- And the share spent below the injured line, in real trouble. -->
							<td>${percent(unit.injuredTime, report.duration)}</td>
						</tr>
					`,
				)}
			</tbody>
		</table>
	`
}

export function manaStatsTable(report: FightReport) {
	const units = report.units.filter(
		(unit) => unit.maxMana !== undefined || unit.manaSpent > 0 || unit.manaBurned > 0 || unit.manaGained > 0,
	)
	if (!units.length) return ''
	return html`
		<table class="FightReport-table" style="--columns: 5">
			<thead>
				<tr>
					<th>mana</th>
					<th>cost</th>
					<th>drained</th>
					<th>gain</th>
					<th>net</th>
					<th>end</th>
				</tr>
			</thead>
			<tbody>
				${units.map(
					(unit) => html`
						<tr>
							<td>${unit.name}</td>
							<td>${unit.manaSpent}</td>
							<td>${unit.manaBurned}</td>
							<td>${unit.manaGained}</td>
							<td>${unit.manaNet}</td>
							<td>${unit.endMana === undefined ? '—' : `${unit.endMana}/${unit.maxMana ?? '?'}`}</td>
						</tr>
					`,
				)}
			</tbody>
		</table>
	`
}

export function abilityStatsTable(report: FightReport) {
	if (!report.abilities.length) return ''
	return html`
		<table class="FightReport-table" style="--columns: 6">
			<thead>
				<tr>
					<th>ability</th>
					<th>casts</th>
					<th>hits</th>
					<th>total</th>
					<th>mana</th>
					<th>avg</th>
					<th>overheal</th>
				</tr>
			</thead>
			<tbody>
				${report.abilities.map(
					(ability) => html`
						<tr>
							<td>${ability.name}</td>
							<td>${ability.casts}</td>
							<td>${ability.hits}</td>
							<td>${ability.total}</td>
							<td>${ability.manaSpent}</td>
							<td>${ability.avg}</td>
							<td>${percent(ability.overheal, ability.total)}</td>
						</tr>
					`,
				)}
			</tbody>
		</table>
	`
}

export function worstCasts(casts: CastStats[], completed: boolean, onScrub: (time: number) => void) {
	if (!casts.length) return ''
	return html`
		<p class="FightReport-worstCasts">
			Wasted casts:
			${casts.map(
				(cast, index) =>
					html`${index ? ' · ' : ' '}${completed
						? html`<button class="FightReport-castLink" onclick=${() => onScrub(cast.time)}>${castLabel(cast)}</button>`
						: html`<span class="FightReport-stat" data-stat="overheal">${castLabel(cast)}</span>`}`,
			)}
		</p>
	`
}

/** "Mend at 14.9s (93%)" — the same words whether it is a link or plain text. */
const castLabel = (cast: CastStats) =>
	`${cast.abilityName} at ${(cast.time / 1000).toFixed(1)}s (${percent(cast.overheal, cast.total)})`

export function simulationControls({
	bot,
	botNames,
	runs,
	busy,
	simulation,
	onBotChange,
	onSimulate,
}: {
	bot: string
	botNames: string[]
	runs: number
	busy: boolean
	simulation: string | null
	onBotChange: (bot: string) => void
	onSimulate: () => void
}) {
	return html`
		<div class="FightReport-controls">
			<select onchange=${(event: Event) => onBotChange((event.target as HTMLSelectElement).value)}>
				${botNames.map((name) => html`<option value=${name} selected=${name === bot}>${name}</option>`)}
			</select>
			<button class="Button" onclick=${onSimulate} disabled=${busy}>Simulate ${runs}×</button>
		</div>
		${simulation ? html`<pre class="FightReport-sim">${simulation}</pre>` : ''}
	`
}

/**
 * Health over time as a filled sparkline. On a finished fight it is also the timeline itself:
 * the scrub cursor draws across it, a death leaves a tick at the bottom, and with `onScrub`
 * set, pressing or dragging anywhere on it moves the cursor there.
 */
function healthGraph(
	points: number[],
	cursor: number | null = null,
	deadAt: number | null = null,
	onScrub: ((fraction: number) => void) | null = null,
) {
	const width = 100
	const height = 20
	const step = width / Math.max(1, points.length - 1)
	const line = points
		.map((point, index) => `${(index * step).toFixed(1)},${((1 - point) * height).toFixed(1)}`)
		.join(' ')
	const x = cursor === null ? '0' : (cursor * width).toFixed(1)
	const deadX = deadAt === null ? '0' : (deadAt * width).toFixed(1)
	const scrubAt = (event: PointerEvent) => {
		if (!onScrub) return
		const rect = (event.currentTarget as Element).getBoundingClientRect()
		onScrub(Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)))
	}
	// The listeners sit on an HTML wrapper, not the svg: uhtml only sets attributes inside
	// foreign (SVG) content, so a listener bound to the svg itself would arrive as a dead string.
	return html`
		<span
			class="FightReport-graphWrap"
			data-scrubbable=${!!onScrub}
			onpointerdown=${(event: PointerEvent) => {
				scrubAt(event)
				;(event.currentTarget as Element).setPointerCapture(event.pointerId)
			}}
			onpointermove=${(event: PointerEvent) => event.buttons && scrubAt(event)}
		>
			<svg class="FightReport-graph" viewBox=${`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
				<polygon points=${`0,${height} ${line} ${width},${height}`} />
				<polyline points=${line} />
				<line
					class="FightReport-death"
					x1=${deadX}
					y1=${height - 6}
					x2=${deadX}
					y2=${height}
					visibility=${deadAt === null ? 'hidden' : 'visible'}
				/>
				<line
					class="FightReport-cursor"
					x1=${x}
					y1="0"
					x2=${x}
					y2=${height}
					visibility=${cursor === null ? 'hidden' : 'visible'}
				/>
			</svg>
		</span>
	`
}
