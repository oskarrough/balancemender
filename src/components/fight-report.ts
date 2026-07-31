import {html, render} from 'uhtml'
import {combatEvents} from '../combatlog'
import {currentGame, type GameLoop} from '../nodes/game-loop'
import {analyze, CastStats, FightReport as Report, Series} from '../sim/report'
import {unitsOf, runFights} from '../sim/run'
import {deathOf, formatAggregate, percentOf as percent} from '../sim/format'
import {bots, BotName} from '../nodes/bot'
import {listFights, viewFight, viewedFight, fightHistoryEvents, type StoredFightMeta} from '../fight-history'

/**
 * The fight you are playing, read the same way a simulated fight is read: `analyze()` over
 * the combat log. Also runs that fight headlessly a few times, so you can see whether the
 * run you just had was typical.
 */
export class FightReportView extends HTMLElement {
	private pending = 0
	private simulation: string | null = null
	private busy = false
	private bot: BotName = 'triage'
	private runs = 5
	private onLogUpdate = () => this.schedule()
	private onHistoryChange = () => this.render()
	/** Where the cursor sits on a completed fight, ms into it. `null` parks it at the end. */
	private scrubTime: number | null = null

	private get game(): GameLoop | undefined {
		return currentGame()
	}

	connectedCallback() {
		combatEvents.addEventListener('combatlog-update', this.onLogUpdate)
		fightHistoryEvents.addEventListener('change', this.onHistoryChange)
		this.render()
	}

	disconnectedCallback() {
		combatEvents.removeEventListener('combatlog-update', this.onLogUpdate)
		fightHistoryEvents.removeEventListener('change', this.onHistoryChange)
		cancelAnimationFrame(this.pending)
	}

	/** Combat is chatty — redraw once per frame at most. */
	private schedule() {
		cancelAnimationFrame(this.pending)
		this.pending = requestAnimationFrame(() => this.render())
	}

	/** Replay the current composition headlessly to see how it usually goes. */
	private async simulate() {
		const game = this.game
		if (!game || this.busy) return
		this.busy = true
		this.simulation = 'Simulating…'
		this.render()
		// Let that paint first — five fights take ~0.2s and the browser does nothing else meanwhile.
		// Nothing worse than that any more: each simulated fight owns its log and its dice, so a
		// live frame landing in the middle of one writes into a different fight's state (#67).
		await new Promise(requestAnimationFrame)
		try {
			// `unitId`, not `constructor.name` — the production build minifies class names.
			const enemies = game.enemies.flatMap((enemy) => enemy.unitId ?? [])
			const party = game.party.filter((member) => member !== game.player).flatMap((member) => member.unitId ?? [])
			const results = await runFights({room: {party, enemies}, bot: this.bot}, this.runs)
			this.simulation = formatAggregate(results)
		} catch (error) {
			this.simulation = String(error)
		} finally {
			this.busy = false
			this.render()
		}
	}

	render() {
		const game = this.game
		if (!game) {
			render(this, () => html`<p>Waiting for game…</p>`)
			return
		}
		const resultOnly = this.getAttribute('mode') === 'result'
		// The result panel is pinned to the fight that just ended, whatever the other panels view.
		const stored = resultOnly ? undefined : viewedFight()
		const viewingHistory = !!stored
		const report = stored
			? analyze(stored.events, {units: stored.units, duration: stored.duration})
			: analyze(game.combatLog.events, {units: unitsOf(game), duration: game.elapsedTime})
		const duration = stored ? stored.duration : game.elapsedTime
		const fps = game.deltaTime > 0 ? Math.round(1000 / game.deltaTime) : 0
		// The scrub only exists on a finished fight — a live one grows under the cursor.
		const completed = viewingHistory || resultOnly || game.gameOver
		const cursor =
			completed && this.scrubTime !== null && report.duration > 0 ? Math.min(1, this.scrubTime / report.duration) : null

		render(
			this,
			() => html`
				<div class="FightReport">
					${resultOnly ? '' : this.history()}
					<p class="FightReport-summary">
						<strong class="FightReport-stat" data-stat="duration">${(duration / 1000).toFixed(1)}s</strong> ·
						<span class="FightReport-stat" data-stat="events">${report.events} events</span> ·
						<span class="FightReport-stat" data-stat="rate">${report.totals.hps} hps</span> ·
						<span class="FightReport-stat" data-stat="rate">${report.totals.dps} dps</span> ·
						<span class="FightReport-stat" data-stat="overheal"
							>${percent(report.totals.overhealing, report.totals.overhealing + report.totals.healing)} overheal</span
						>
						${stored || resultOnly
							? ''
							: html` · <span class="FightReport-stat" data-stat="fps">${fps} fps</span> ·
									<span class="FightReport-stat" data-stat="gcd">gcd ${game.player?.gcd ? 'on' : 'off'}</span>`}
					</p>

					<ul class="FightReport-units">
						${report.health.map((unit) =>
							this.unit(unit, report, cursor, completed && report.duration > 0 ? (time) => this.scrubTo(time) : null),
						)}
						${completed && report.duration > 0 ? this.scrubber(report) : ''}
					</ul>

					<table class="FightReport-table">
						<thead>
							<tr>
								<th>unit</th>
								<th>dmg</th>
								<th>heal</th>
								<th>overheal</th>
								<th>taken</th>
								<th>casts</th>
								<th>mana</th>
								<th>busy</th>
								<th>hurt</th>
							</tr>
						</thead>
						<tbody>
							${report.units.map(
								(unit) => html`
									<tr>
										<td>${unit.name}</td>
										<td>${unit.damageDone}</td>
										<td>${unit.healingDone}</td>
										<td>${percent(unit.overhealing, unit.healingDone + unit.overhealing)}</td>
										<td>${unit.damageTaken}</td>
										<td>${unit.casts}</td>
										<td>${unit.manaSpent}</td>
										<!-- Share of the fight spent committed to a cast or its global cooldown. -->
										<td>${percent(unit.busyTime, report.duration)}</td>
										<!-- And the share spent below the injured line, in real trouble. -->
										<td>${percent(unit.injuredTime, report.duration)}</td>
									</tr>
								`,
							)}
						</tbody>
					</table>

					${report.abilities.length
						? html`
								<table class="FightReport-table">
									<thead>
										<tr>
											<th>ability</th>
											<th>casts</th>
											<th>hits</th>
											<th>total</th>
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
													<td>${ability.avg}</td>
													<td>${percent(ability.overheal, ability.total)}</td>
												</tr>
											`,
										)}
									</tbody>
								</table>
							`
						: ''}
					${report.worstCasts.length
						? html`
								<p class="FightReport-worstCasts">
									Wasted casts:
									${report.worstCasts.map(
										(cast, i) =>
											html`${i ? ' · ' : ' '}${completed
												? html`<button class="FightReport-castLink" onclick=${() => this.scrubTo(cast.time)}>
														${castLabel(cast)}
													</button>`
												: html`<span class="FightReport-stat" data-stat="overheal">${castLabel(cast)}</span>`}`,
									)}
								</p>
							`
						: ''}
					${viewingHistory || resultOnly
						? ''
						: html`
								<div class="FightReport-controls">
									<select
										onchange=${(e: Event) => {
											this.bot = (e.target as HTMLSelectElement).value as BotName
										}}
									>
										${Object.keys(bots).map(
											(name) => html`<option value=${name} selected=${name === this.bot}>${name}</option>`,
										)}
									</select>
									<button class="Button" onclick=${() => this.simulate()} disabled=${this.busy}>
										Simulate ${this.runs}×
									</button>
								</div>
								${this.simulation ? html`<pre class="FightReport-sim">${this.simulation}</pre>` : ''}
							`}
				</div>
			`,
		)
	}

	/** Past fights, newest first, plus a Live entry that returns to the current fight. A dropdown, because chips stopped scaling past a handful of fights. */
	private history() {
		const fights = listFights()
		if (!fights.length) return ''
		const selected = viewedFight()?.id ?? null
		return html`
			<select
				class="FightReport-history"
				data-outcome=${fights.find((f) => f.id === selected)?.outcome ?? 'live'}
				onchange=${(event: Event) => {
					const value = (event.target as HTMLSelectElement).value
					this.scrubTime = null
					viewFight(value === 'live' ? null : value)
				}}
			>
				<option value="live" ?selected=${selected === null}>Live</option>
				${fights.map((fight) => this.historyOption(fight))}
			</select>
		`
	}

	private historyOption(fight: StoredFightMeta) {
		const date = new Date(fight.timestamp)
		const when = date.toLocaleString(undefined, {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'})
		return html`
			<option value=${fight.id} ?selected=${viewedFight()?.id === fight.id}>
				${fight.outcome} · ${(fight.duration / 1000).toFixed(1)}s · ${when}
			</option>
		`
	}

	/** The #65 cursor: drag through a finished fight, and the graphs and Combat log follow. */
	private scrubber(report: Report) {
		const value = this.scrubTime ?? report.duration
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
					oninput=${(event: Event) => this.scrubTo(Number((event.target as HTMLInputElement).value))}
				/>
				<span class="FightReport-unitHealth">${(value / 1000).toFixed(1)}s</span>
			</li>
		`
	}

	/** Move the cursor and point the Combat log at the same moment. */
	private scrubTo(time: number) {
		this.scrubTime = time
		const stored = viewedFight()
		// The result panel is pinned to the live fight — while the other panels are on a stored
		// one, its times would land somewhere meaningless in them.
		if (!(this.getAttribute('mode') === 'result' && stored)) {
			const start = (stored?.events ?? this.game?.combatLog.events ?? [])[0]?.time ?? 0
			combatEvents.dispatchEvent(new CustomEvent('combatlog-seek', {detail: start + time}))
		}
		this.render()
	}

	private unit(unit: Series, report: Report, cursor: number | null, scrub: ((time: number) => void) | null) {
		const death = report.deaths.find((d) => deathOf(d, unit))
		const column = cursor === null ? -1 : Math.min(unit.points.length - 1, Math.floor(cursor * unit.points.length))
		const ratio = cursor === null ? unit.endHealth / unit.maxHealth : unit.points[column]
		const label =
			cursor === null && death
				? `dead ${(death.time / 1000).toFixed(1)}s`
				: ratio > 0
					? `${Math.round(ratio * 100)}%`
					: 'dead'
		const deadAt = death ? Math.min(1, death.time / report.duration) : null
		return html`
			<li class="FightReport-unit" data-faction=${unit.faction}>
				<span class="FightReport-unitName">${unit.name}</span>
				${graph(unit.points, cursor, deadAt, scrub && ((fraction: number) => scrub(fraction * report.duration)))}
				<span class="FightReport-unitHealth">${label}</span>
			</li>
		`
	}
}

/** "Heal at 14.9s (93%)" — the same words whether it is a link or plain text. */
const castLabel = (cast: CastStats) =>
	`${cast.abilityName} at ${(cast.time / 1000).toFixed(1)}s (${percent(cast.overheal, cast.total)})`

/**
 * Health over time as a filled sparkline. On a finished fight it is also the timeline itself:
 * the scrub cursor draws across it, a death leaves a tick at the bottom, and with `onScrub`
 * set, pressing or dragging anywhere on it moves the cursor there.
 */
function graph(
	points: number[],
	cursor: number | null = null,
	deadAt: number | null = null,
	onScrub: ((fraction: number) => void) | null = null,
) {
	const width = 100
	const height = 20
	const step = width / Math.max(1, points.length - 1)
	const line = points.map((point, i) => `${(i * step).toFixed(1)},${((1 - point) * height).toFixed(1)}`).join(' ')
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

customElements.define('fight-report', FightReportView)
