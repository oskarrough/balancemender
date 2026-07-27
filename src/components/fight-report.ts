import {html, render} from '../utils'
import {combatLogs} from '../combatlog'
import {currentGame, type GameLoop} from '../nodes/game-loop'
import {analyze, FightReport as Report, Series} from '../sim/report'
import {rosterOf, runFights} from '../sim/run'
import {deathOf, formatAggregate, percentOf as percent} from '../sim/format'
import {policies, PolicyName} from '../nodes/autopilot'

/**
 * The fight you are playing, read the same way a simulated fight is read: `analyze()` over
 * the combat log. Also runs that fight headlessly a few times, so you can see whether the
 * run you just had was typical.
 */
export class FightReportView extends HTMLElement {
	private pending = 0
	private simulation: string | null = null
	private busy = false
	private policy: PolicyName = 'triage'
	private runs = 5
	private onLogUpdate = () => this.schedule()

	private get game(): GameLoop | undefined {
		return currentGame()
	}

	connectedCallback() {
		document.addEventListener('combatlog-update', this.onLogUpdate)
		this.render()
	}

	disconnectedCallback() {
		document.removeEventListener('combatlog-update', this.onLogUpdate)
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
			const results = await runFights({party, enemies, policy: this.policy}, this.runs)
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
		const report = analyze(combatLogs, {roster: rosterOf(game), duration: game.elapsedTime})

		render(
			this,
			() => html`
				<div class="FightReport">
					<p class="FightReport-summary">
						<strong>${(game.elapsedTime / 1000).toFixed(1)}s</strong> · ${report.events} events · ${report.totals.hps}
						hps · ${report.totals.dps} dps ·
						${percent(report.totals.overhealing, report.totals.overhealing + report.totals.healing)} overheal
					</p>

					<ul class="FightReport-units">
						${report.health.map((unit) => this.unit(unit, report))}
					</ul>

					<table class="FightReport-table">
						<thead>
							<tr>
								<th>actor</th>
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
							${report.actors.map(
								(actor) => html`
									<tr>
										<td>${actor.name}</td>
										<td>${actor.damageDone}</td>
										<td>${actor.healingDone}</td>
										<td>${percent(actor.overhealing, actor.healingDone + actor.overhealing)}</td>
										<td>${actor.damageTaken}</td>
										<td>${actor.casts}</td>
										<td>${actor.manaSpent}</td>
										<!-- Share of the fight spent committed to a cast or its global cooldown. -->
										<td>${percent(actor.busyTime, report.duration)}</td>
										<!-- And the share spent below the injured line, in real trouble. -->
										<td>${percent(actor.injuredTime, report.duration)}</td>
									</tr>
								`,
							)}
						</tbody>
					</table>

					${report.spells.length
						? html`
								<table class="FightReport-table">
									<thead>
										<tr>
											<th>spell</th>
											<th>casts</th>
											<th>hits</th>
											<th>total</th>
											<th>avg</th>
											<th>overheal</th>
										</tr>
									</thead>
									<tbody>
										${report.spells.map(
											(spell) => html`
												<tr>
													<td>${spell.name}</td>
													<td>${spell.casts}</td>
													<td>${spell.hits}</td>
													<td>${spell.total}</td>
													<td>${spell.avg}</td>
													<td>${percent(spell.overheal, spell.total)}</td>
												</tr>
											`,
										)}
									</tbody>
								</table>
							`
						: ''}

					<div class="FightReport-controls">
						<select
							onchange=${(e: Event) => {
								this.policy = (e.target as HTMLSelectElement).value as PolicyName
							}}
						>
							${Object.keys(policies).map(
								(name) => html`<option value=${name} selected=${name === this.policy}>${name}</option>`,
							)}
						</select>
						<button class="Button" onclick=${() => this.simulate()} disabled=${this.busy}>
							Simulate ${this.runs}×
						</button>
					</div>
					${this.simulation ? html`<pre class="FightReport-sim">${this.simulation}</pre>` : ''}
				</div>
			`,
		)
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
