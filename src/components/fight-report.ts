import {html, render} from 'uhtml'
import {combatEvents} from '../combatlog'
import {fightHistoryEvents, listFights, viewedFight, viewFight} from '../fight-history'
import {bots, type BotName} from '../nodes/bot'
import {currentGame, type GameLoop} from '../nodes/game-loop'
import {formatAggregate} from '../sim/format'
import {analyze} from '../sim/report'
import {runFights, unitsOf} from '../sim/run'
import {
	abilityStatsTable,
	fightSummary,
	healthTimeline,
	historySelect,
	simulationControls,
	unitStatsTable,
	worstCasts,
} from './fight-report-sections'

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
		const onScrub = completed && report.duration > 0 ? (time: number) => this.scrubTo(time) : null

		render(
			this,
			() => html`
				<div class="FightReport">
					${resultOnly
						? ''
						: historySelect({
								fights: listFights(),
								selected: stored?.id ?? null,
								onSelect: (id) => {
									this.scrubTime = null
									viewFight(id)
								},
							})}
					${fightSummary({
						report,
						duration,
						live: stored || resultOnly ? null : {fps, gcd: !!game.player?.gcd},
					})}
					${healthTimeline({report, cursor, scrubTime: this.scrubTime, onScrub})} ${unitStatsTable(report)}
					${abilityStatsTable(report)} ${worstCasts(report.worstCasts, completed, (time) => this.scrubTo(time))}
					${viewingHistory || resultOnly
						? ''
						: simulationControls({
								bot: this.bot,
								botNames: Object.keys(bots),
								runs: this.runs,
								busy: this.busy,
								simulation: this.simulation,
								onBotChange: (bot) => {
									this.bot = bot as BotName
								},
								onSimulate: () => this.simulate(),
							})}
				</div>
			`,
		)
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
}

customElements.define('fight-report', FightReportView)
