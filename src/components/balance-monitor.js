import {html, render, roundOne} from '../utils'
import {Task} from 'vroum'
import {getCombatLogs} from '../combatlog'

/** more ideas

filter types? summary, damage done, damage taken, healing, buffs, debuffs, deaths, interrupts, dispels, resources, casts

damage done+taken: name, amount percentage, total, mitigated, dtakenpersecond
healing: normal absorbed, crits

https://www.warcraftlogs.com/
https://www.wowhead.com/guide/how-to-use-warcraft-logs-6341
*/

// Helper function to create a visual progress bar
function createProgressBar(percent, value, total, barLength = 10) {
	const filledBars = Math.floor((percent / 100) * barLength)
	const emptyBars = barLength - filledBars
	const barDisplay = '-'.repeat(filledBars) + 'X' + '-'.repeat(emptyBars - 1)
	return `[${barDisplay}] ${Math.round(percent)}% ${total}`
}

class AnalyzeTask extends Task {
	constructor(parent) {
		super()
		this.parent = parent
	}

	tick() {
		this.parent.updateMetrics()
	}
}

export class BalanceMonitor extends HTMLElement {
	analyzer = new AnalyzeTask(this)

	constructor() {
		super()

		this.metrics = {
			period: 30, // seconds to analyze
			lastUpdate: 0,
			startTime: Date.now(),

			// Aggregate stats
			totalDamage: 0,
			totalHealing: 0,
			totalManaSpent: 0,
			damageEvents: 0,
			healingEvents: 0,

			// Per-character stats
			characters: new Map(),
		}

		this.render()
	}

	connectedCallback() {
		document.addEventListener('combatlog-update', this.handleLogUpdate.bind(this))
		this.render()
	}

	disconnectedCallback() {
		document.removeEventListener('combatlog-update', this.handleLogUpdate.bind(this))
		this.analyzer.disconnect()
	}

	handleLogUpdate(event) {
		// We'll do bulk updates in updateMetrics instead of per-event
		if (Date.now() - this.metrics.lastUpdate > 1000) {
			this.updateMetrics()
		}
	}

	getCharacterMetrics(id, name) {
		if (!this.metrics.characters.has(id)) {
			this.metrics.characters.set(id, {
				id,
				name,
				faction: null, // Will be populated based on game state
				totalDamage: 0,
				totalHealing: 0,
				totalManaSpent: 0,
				damageEvents: 0,
				healingEvents: 0,
			})
		}
		return this.metrics.characters.get(id)
	}

	updateMetrics() {
		const cutoffTime = Date.now() - this.metrics.period * 1000
		const recentLogs = getCombatLogs().filter((log) => log.timestamp > cutoffTime)

		// Reset counters
		this.metrics.totalDamage = 0
		this.metrics.totalHealing = 0
		this.metrics.totalManaSpent = 0
		this.metrics.damageEvents = 0
		this.metrics.healingEvents = 0
		this.metrics.characters.clear()

		// Update faction info if balancemender is available
		if (window.balancemender) {
			window.balancemender.party.forEach((character) => {
				if (character.id) {
					const charMetrics = this.getCharacterMetrics(
						character.id,
						character.name || 'Party Member',
					)
					charMetrics.faction = 'party'
				}
			})

			window.balancemender.enemies.forEach((enemy) => {
				if (enemy.id) {
					const charMetrics = this.getCharacterMetrics(enemy.id, enemy.name || 'Enemy')
					charMetrics.faction = 'enemy'
				}
			})
		}

		// Count events by type
		for (const log of recentLogs) {
			// Track per-source stats (who's doing the damage/healing)
			if (log.sourceId && log.sourceName) {
				const sourceMetrics = this.getCharacterMetrics(log.sourceId, log.sourceName)

				if (
					log.eventType === 'SPELL_DAMAGE' ||
					log.eventType === 'SWING_DAMAGE' ||
					log.eventType === 'RANGE_DAMAGE' ||
					log.eventType === 'SPELL_PERIODIC_DAMAGE'
				) {
					sourceMetrics.totalDamage += log.value || 0
					sourceMetrics.damageEvents += 1
				} else if (
					log.eventType === 'SPELL_HEAL' ||
					log.eventType === 'SPELL_PERIODIC_HEAL' ||
					log.eventType === 'PERIODIC_SPELL_HEAL'
				) {
					sourceMetrics.totalHealing += log.value || 0
					sourceMetrics.healingEvents += 1
				} else if (
					log.eventType === 'RESOURCE_CHANGE' &&
					log.extraInfo === 'MANA' &&
					log.value < 0
				) {
					sourceMetrics.totalManaSpent += Math.abs(log.value || 0)
				}
			}

			// Update aggregate stats
			if (
				log.eventType === 'SPELL_DAMAGE' ||
				log.eventType === 'SWING_DAMAGE' ||
				log.eventType === 'RANGE_DAMAGE' ||
				log.eventType === 'SPELL_PERIODIC_DAMAGE'
			) {
				this.metrics.totalDamage += log.value || 0
				this.metrics.damageEvents += 1
			} else if (
				log.eventType === 'SPELL_HEAL' ||
				log.eventType === 'SPELL_PERIODIC_HEAL' ||
				log.eventType === 'PERIODIC_SPELL_HEAL'
			) {
				this.metrics.totalHealing += log.value || 0
				this.metrics.healingEvents += 1
			} else if (
				log.eventType === 'RESOURCE_CHANGE' &&
				log.extraInfo === 'MANA' &&
				log.value < 0
			) {
				this.metrics.totalManaSpent += Math.abs(log.value || 0)
			}
		}

		this.metrics.lastUpdate = Date.now()
		this.render()
	}

	calculateSurvivalRating() {
		const dps = this.metrics.totalDamage / this.metrics.period
		const hps = this.metrics.totalHealing / this.metrics.period

		if (dps <= 0) return '10/10'

		// Calculate how much our healing outpaces or falls behind incoming damage
		const ratio = hps / dps

		// More sophisticated rating that gives more nuance:
		// - Ratio of 1.0 (keeping even) gives a 5/10
		// - Ratio of 2.0 or higher (healing double the damage) gives 10/10
		// - Ratio of 0.0 (no healing) gives 0/10
		const rating = Math.min(10, Math.max(0, Math.round(ratio * 5)))

		return `${rating}/10`
	}

	calculateTimeToLive() {
		if (!window.balancemender?.player?.health) return 'N/A'

		// Get damage and healing per second
		const dps = this.metrics.totalDamage / this.metrics.period
		const hps = this.metrics.totalHealing / this.metrics.period

		// Calculate net damage after healing
		const netDps = Math.max(0, dps - hps)

		if (netDps <= 0) return '∞'

		// Get total party health for more accurate estimation
		let totalPartyHealth = 0
		if (window.balancemender) {
			window.balancemender.party.forEach((member) => {
				if (member.health) {
					totalPartyHealth += member.health.current
				}
			})
		} else {
			// Fallback to just player health
			totalPartyHealth = window.balancemender.player.health.current
		}

		// Consider mana constraints - if we'll run out of mana, healing stops
		const timeToOOM = this.calculateRawTimeToOOM()

		// Calculate basic time to live based on health and net damage
		const secondsToLiveBasedOnHealth = Math.floor(totalPartyHealth / netDps)

		// If we'll run out of mana before dying, we need to recalculate
		if (timeToOOM !== Infinity && timeToOOM < secondsToLiveBasedOnHealth) {
			// After OOM, we take full damage with no healing
			const remainingHealthAtOOM = totalPartyHealth - netDps * timeToOOM
			const secondsAfterOOM = Math.floor(remainingHealthAtOOM / dps)

			// Total survival time is time until OOM plus time after OOM
			return Math.max(0, timeToOOM + secondsAfterOOM) + 's'
		}

		return secondsToLiveBasedOnHealth + 's'
	}

	// Raw time to OOM calculation (without formatting)
	calculateRawTimeToOOM() {
		if (!window.balancemender?.player?.mana) return Infinity

		const manaPerSec = this.metrics.totalManaSpent / this.metrics.period
		if (manaPerSec <= 0) return Infinity

		const currentMana = window.balancemender.player.mana.current
		return Math.floor(currentMana / manaPerSec)
	}

	// Formatted time to OOM for display
	calculateTimeToOOM() {
		const secondsToOOM = this.calculateRawTimeToOOM()
		if (secondsToOOM === Infinity) return '∞'
		return secondsToOOM + 's'
	}

	render() {
		const timePassed = Math.max(
			1,
			Math.round((Date.now() - this.metrics.startTime) / 1000),
		)
		const period = Math.min(timePassed, this.metrics.period)

		// Calculate metrics
		const dps = roundOne(this.metrics.totalDamage / period)
		const hps = roundOne(this.metrics.totalHealing / period)
		const avgHeal =
			this.metrics.healingEvents > 0
				? Math.round(this.metrics.totalHealing / this.metrics.healingEvents)
				: 0
		const avgDamage =
			this.metrics.damageEvents > 0
				? Math.round(this.metrics.totalDamage / this.metrics.damageEvents)
				: 0
		const hpm =
			this.metrics.totalManaSpent > 0
				? roundOne(this.metrics.totalHealing / this.metrics.totalManaSpent)
				: 0
		const mps = roundOne(this.metrics.totalManaSpent / period)

		// Sort characters by faction and then by name
		const partyMembers = [...this.metrics.characters.values()]
			.filter((char) => char.faction === 'party')
			.sort((a, b) => a.name.localeCompare(b.name))

		const enemies = [...this.metrics.characters.values()]
			.filter((char) => char.faction === 'enemy')
			.sort((a, b) => a.name.localeCompare(b.name))

		render(
			this,
			() => html`
				<section>
					<h3>Enemies (${period}s)</h3>
					${enemies.length > 0
						? html`
								<table>
									<thead>
										<tr>
											<th>Name</th>
											<th title="Damage Per Second">DPS</th>
											<th title="Total Damage">Damage</th>
											<th title="Damage Share">Share</th>
										</tr>
									</thead>
									<tbody>
										${enemies.map((enemy) => {
											const damagePercent =
												this.metrics.totalDamage > 0
													? (enemy.totalDamage / this.metrics.totalDamage) * 100
													: 0
											return html`
												<tr>
													<td>${enemy.name}</td>
													<td>${roundOne(enemy.totalDamage / period)}</td>
													<td>${Math.floor(enemy.totalDamage)}</td>
													<td>
														${createProgressBar(
															damagePercent,
															enemy.totalDamage,
															Math.floor(enemy.totalDamage),
														)}
													</td>
												</tr>
											`
										})}
										<tr class="total">
											<td>Total</td>
											<td>${dps}</td>
											<td>${Math.floor(this.metrics.totalDamage)}</td>
											<td>[----------] 100% ${Math.floor(this.metrics.totalDamage)}</td>
										</tr>
									</tbody>
								</table>
							`
						: html`<p>No enemy activity detected</p>`}
				</section>

				<section>
					<h3>Party Members</h3>
					${partyMembers.length > 0
						? html`
								<table>
									<thead>
										<tr>
											<th>Name</th>
											<th title="Healing Per Second">HPS</th>
											<th title="Total Healing">Healing</th>
											<th title="Healing Share">Heal Share</th>
											<th title="Damage Per Second">DPS</th>
											<th title="Total Damage">Damage</th>
										</tr>
									</thead>
									<tbody>
										${partyMembers.map((member) => {
											const healPercent =
												this.metrics.totalHealing > 0
													? (member.totalHealing / this.metrics.totalHealing) * 100
													: 0
											return html`
												<tr>
													<td>${member.name}</td>
													<td>${roundOne(member.totalHealing / period)}</td>
													<td>${Math.floor(member.totalHealing)}</td>
													<td>
														${createProgressBar(
															healPercent,
															member.totalHealing,
															Math.floor(member.totalHealing),
														)}
													</td>
													<td>${roundOne(member.totalDamage / period)}</td>
													<td>${Math.floor(member.totalDamage)}</td>
												</tr>
											`
										})}
										<tr class="total">
											<td>Total</td>
											<td>${hps}</td>
											<td>${Math.floor(this.metrics.totalHealing)}</td>
											<td>[----------] 100% ${Math.floor(this.metrics.totalHealing)}</td>
											<td colspan="2"></td>
										</tr>
									</tbody>
								</table>
							`
						: html`<p>No party activity detected</p>`}
				</section>

				<section>
					<h3>Resources & Efficiency</h3>
					<dl>
						<dt title="Mana Per Second - Your average mana consumption rate">
							Mana per sec:
						</dt>
						<dd>${mps}</dd>
						<dt
							title="Estimated time until you run out of mana at current consumption rate"
						>
							Time to OOM:
						</dt>
						<dd>${this.calculateTimeToOOM()}</dd>
						<dt
							title="Healing Per Mana - How much healing you get for each point of mana spent"
						>
							Healing per mana:
						</dt>
						<dd>${hpm}</dd>
					</dl>
				</section>

				<section>
					<h3>Survival Analysis</h3>
					<dl>
						<dt
							title="Rating of how well healing keeps up with incoming damage (10 is best)"
						>
							Survival rating:
						</dt>
						<dd>${this.calculateSurvivalRating()}</dd>
						<dt
							title="Ratio of healing output to incoming damage - values over 1.0 mean you're keeping up"
						>
							HPS/DPS ratio:
						</dt>
						<dd>${dps > 0 ? roundOne(hps / dps) : 'N/A'}</dd>
						<dt
							title="Estimated time until death based on current damage vs healing rate"
						>
							Time to live:
						</dt>
						<dd>${this.calculateTimeToLive()}</dd>
						${dps > 0 && hps > 0
							? html`
									<dt title="Visual ratio of healing vs damage">Healing vs Damage:</dt>
									<dd>${createProgressBar((hps / dps) * 50, hps, hps + '/' + dps)}</dd>
								`
							: ''}
					</dl>
				</section>
			`,
		)
	}
}

customElements.define('balance-monitor', BalanceMonitor)
