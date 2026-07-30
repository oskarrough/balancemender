import {html, render} from 'uhtml'
import {combatEvents, combatLogs} from '../combatlog'
import {currentGame, type GameLoop} from '../nodes/game-loop'
import {analyze, FightReport as Report, Series} from '../sim/report'
import {unitsOf, runFights} from '../sim/run'
import {deathOf, formatAggregate, percentOf as percent} from '../sim/format'
import {bots, BotName} from '../nodes/bot'
import {listFights, getFight, fightHistoryEvents, type StoredFightMeta} from '../fight-history'

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
	private selectedFightId: string | null = null

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
		// Let that paint first. Once started, the run below never yields to the event loop —
		// it borrows the combat log, the clock and the RNG, so a live frame landing in the
		// middle would write into the simulation's log and vice versa. Five fights take ~0.2s.
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
		const stored = this.selectedFightId ? getFight(this.selectedFightId) : undefined
		const viewingHistory = this.selectedFightId !== null && !!stored
		const report = stored
			? analyze(stored.events, {units: stored.units, duration: stored.duration})
			: analyze(combatLogs, {units: unitsOf(game), duration: game.elapsedTime})
		const duration = stored ? stored.duration : game.elapsedTime
		const fps = game.deltaTime > 0 ? Math.round(1000 / game.deltaTime) : 0

		render(
			this,
			() => html`
				<div class="FightReport">
					${this.history()}
					<p class="FightReport-summary">
						<strong class="FightReport-stat" data-stat="duration">${(duration / 1000).toFixed(1)}s</strong> ·
						<span class="FightReport-stat" data-stat="events">${report.events} events</span> ·
						<span class="FightReport-stat" data-stat="rate">${report.totals.hps} hps</span> ·
						<span class="FightReport-stat" data-stat="rate">${report.totals.dps} dps</span> ·
						<span class="FightReport-stat" data-stat="overheal"
							>${percent(report.totals.overhealing, report.totals.overhealing + report.totals.healing)} overheal</span
						>
						${stored
							? ''
							: html` · <span class="FightReport-stat" data-stat="fps">${fps} fps</span> ·
									<span class="FightReport-stat" data-stat="gcd">gcd ${game.player?.gcd ? 'on' : 'off'}</span>`}
					</p>

					<ul class="FightReport-units">
						${report.health.map((unit) => this.unit(unit, report))}
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
					${viewingHistory
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

	/** Past fights, newest first, plus a Live entry that returns to the current fight. */
	private history() {
		const fights = listFights()
		if (!fights.length) return ''
		return html`
			<ul class="FightReport-history">
				<li>
					<button
						class="FightReport-historyItem"
						data-active=${this.selectedFightId === null}
						onclick=${() => {
							this.selectedFightId = null
							this.render()
						}}
					>
						Live
					</button>
				</li>
				${fights.map((fight) => this.historyItem(fight))}
			</ul>
		`
	}

	private historyItem(fight: StoredFightMeta) {
		const date = new Date(fight.timestamp)
		const when = date.toLocaleString(undefined, {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'})
		return html`
			<li>
				<button
					class="FightReport-historyItem"
					data-outcome=${fight.outcome}
					data-active=${this.selectedFightId === fight.id}
					onclick=${() => {
						this.selectedFightId = fight.id
						this.render()
					}}
				>
					${fight.outcome} · ${(fight.duration / 1000).toFixed(1)}s · ${when}
				</button>
			</li>
		`
	}

	private unit(unit: Series, report: Report) {
		const death = report.deaths.find((d) => deathOf(d, unit))
		const ratio = unit.endHealth / unit.maxHealth
		return html`
			<li class="FightReport-unit" data-faction=${unit.faction}>
				<span class="FightReport-unitName">${unit.name}</span>
				${graph(unit.points)}
				<span class="FightReport-unitHealth">
					${death ? `dead ${(death.time / 1000).toFixed(1)}s` : `${Math.round(ratio * 100)}%`}
				</span>
			</li>
		`
	}
}

/** Health over time as a filled sparkline. */
function graph(points: number[]) {
	const width = 100
	const height = 20
	const step = width / Math.max(1, points.length - 1)
	const line = points.map((point, i) => `${(i * step).toFixed(1)},${((1 - point) * height).toFixed(1)}`).join(' ')
	return html`
		<svg class="FightReport-graph" viewBox=${`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
			<polygon points=${`0,${height} ${line} ${width},${height}`} />
			<polyline points=${line} />
		</svg>
	`
}

customElements.define('fight-report', FightReportView)
