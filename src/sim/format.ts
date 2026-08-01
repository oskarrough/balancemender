import {analyze, healerOf, margin, FightReport, Series} from './report'
import type {FightResult, Outcome} from './run'

/** Plain-text fight reports. No colours, so they pipe and diff cleanly. */

const BLOCKS = '▁▂▃▄▅▆▇█'
const OUTCOMES: Outcome[] = ['victory', 'defeat', 'timeout']

/** Who fought, by display name, and how the healer played. */
const lineup = (result: FightResult) => ({
	party: result.units.filter((unit) => unit.faction === 'party').map((unit) => unit.name),
	enemies: result.units.filter((unit) => unit.faction === 'enemy').map((unit) => unit.name),
	bot: typeof result.trial.bot === 'string' ? result.trial.bot : (result.trial.bot?.name ?? 'triage'),
})

/** A health bar over time: one block per column, `·` once the unit is dead. */
export function sparkline(points: number[]) {
	return points
		.map((point) => {
			if (point <= 0) return '·'
			return BLOCKS[Math.min(BLOCKS.length - 1, Math.max(0, Math.ceil(point * BLOCKS.length) - 1))]
		})
		.join('')
}

export function formatFight(result: FightResult, report = analyze(result.events, result)): string {
	const lines: string[] = []
	const {party, enemies, bot} = lineup(result)

	lines.push(
		`${party.join(' + ')}  vs  ${enemies.join(' + ')}`,
		`seed ${result.seed} · ${bot} · ${result.outcome} in ${seconds(result.duration)}`,
		'',
	)

	const nameWidth = Math.max(...report.health.map((s) => s.name.length), 10)
	for (const unit of report.health) {
		lines.push(`  ${pad(unit.name, nameWidth)}  ${sparkline(unit.points)}  ${endState(unit, report)}`)
	}

	lines.push(
		'',
		table(
			['unit', 'dmg', 'dps', 'heal', 'hps', 'overheal', 'absorb', 'wasted', 'taken', 'casts', 'busy', 'hurt'],
			report.units.map((a) => [
				a.name,
				a.damageDone,
				perSecond(a.damageDone, report.duration),
				a.healingDone,
				perSecond(a.healingDone, report.duration),
				percentOf(a.overhealing, a.healingDone + a.overhealing),
				a.absorbed,
				// Same shape as overheal: the share of what a shield could have swallowed that
				// nobody ever hit into it.
				percentOf(a.wasted, a.absorbed + a.wasted),
				a.damageTaken,
				a.casts,
				percentOf(a.busyTime, report.duration),
				percentOf(a.injuredTime, report.duration),
			]),
		),
	)

	if (report.abilities.length) {
		lines.push(
			'',
			table(
				// `per s` rather than only a total, because a total says nothing about whether a bleed
				// is worth its slot next to a bite that swings three times as often.
				['ability', 'casts', 'hits', 'total', 'per s', 'avg', 'overheal'],
				report.abilities.map((s) => [
					s.name,
					s.casts,
					s.hits,
					s.total,
					perSecond(s.total, report.duration),
					s.avg,
					percentOf(s.overheal, s.total),
				]),
			),
		)
	}

	if (report.worstCasts.length) {
		lines.push(
			'',
			`  wasted casts  ${report.worstCasts
				.map((c) => `${c.abilityName} ${seconds(c.time)} (${percentOf(c.overheal, c.total)})`)
				.join(', ')}`,
		)
	}

	if (report.deaths.length) {
		lines.push('', `  deaths  ${report.deaths.map((d) => `${d.name} ${seconds(d.time)}`).join(', ')}`)
	}

	return lines.join('\n')
}

/** How a batch of runs of the same fight turned out. */
export function formatAggregate(results: FightResult[]): string {
	const reports = results.map((result) => analyze(result.events, result))
	const healers = reports.map(healerOf)
	const durations = results.map((r) => r.duration)
	const runtime = avg(durations)
	const outcomes = count(results.map((r) => r.outcome))
	const deaths = count(reports.flatMap((r) => r.deaths.map((d) => d.name)))
	const {party, enemies, bot} = lineup(results[0])
	const victories = outcomes.get('victory') ?? 0
	const absorbed = avg(healers.map((h) => h?.absorbed ?? 0))
	const wasted = avg(healers.map((h) => h?.wasted ?? 0))

	const lines = [
		`${results.length} fights · ${party.join(' + ')} vs ${enemies.join(' + ')} · ${bot}`,
		'',
		'  ' +
			OUTCOMES.map(
				(key) => `${key} ${outcomes.get(key) ?? 0} (${Math.round(((outcomes.get(key) ?? 0) / results.length) * 100)}%)`,
			).join('   '),
		`  duration  avg ${seconds(runtime)}  min ${seconds(Math.min(...durations))}  max ${seconds(Math.max(...durations))}`,
		`  healing   avg ${avg(reports.map((r) => r.totals.hps)).toFixed(1)} hps  overheal ${percentOf(
			avg(reports.map((r) => r.totals.overhealing)),
			avg(reports.map((r) => r.totals.overhealing + r.totals.healing)),
		)}`,
		`  damage    avg ${avg(reports.map((r) => r.totals.dps)).toFixed(1)} dps`,
		// The healer's own row, because the two lines above are fight-wide — an enemy healer's work
		// lands in `totals.healing` too. `busy` is how much of the fight it was locked into a cast:
		// low with mana to spare means the bot is timid, low with an empty bar means mana is the
		// wall and no amount of cleverer decision-making gets past it.
		`  healer    ${perSecond(avg(healers.map((h) => h?.healingDone ?? 0)), runtime)} hps  busy ${percentOf(
			avg(healers.map((h) => h?.busyTime ?? 0)),
			runtime,
		)}  mana ${Math.round(avg(healers.map((h) => h?.manaSpent ?? 0)))}`,
	]
	// Only when a shield was actually cast, the way `deaths` only shows up if there were any —
	// a healer with no shields would print `0 aps  wasted 0%` on every run otherwise.
	if (absorbed || wasted) {
		lines.push(`  shield    ${perSecond(absorbed, runtime)} aps  wasted ${percentOf(wasted, absorbed + wasted)}`)
	}
	if (deaths.size) {
		lines.push(`  deaths    ${[...deaths].map(([name, n]) => `${name} ${n}/${results.length}`).join('   ')}`)
	}
	// The same warning the sweep prints, for the same reason: a handful of fights is a handful of
	// coin flips, and the win rate above moves by more than most retunes do.
	lines.push('', `  win rate ±${margin(victories, results.length)} points at ${results.length} fights (95%)`)
	return lines.join('\n')
}

function endState(unit: Series, report: FightReport) {
	const death = report.deaths.find((d) => deathOf(d, unit))
	if (death) return `dead ${seconds(death.time)}`
	if (unit.endHealth <= 0) return 'dead'
	return `${Math.round(unit.endHealth)}/${unit.maxHealth} (${Math.round((unit.endHealth / unit.maxHealth) * 100)}%)`
}

function table(headers: string[], rows: (string | number)[][]) {
	const widths = headers.map((header, i) => Math.max(header.length, ...rows.map((row) => String(row[i]).length)))
	const line = (cells: (string | number)[]) =>
		'  ' + cells.map((cell, i) => (i === 0 ? pad(cell, widths[i]) : padStart(cell, widths[i] + 2))).join('')
	return [line(headers), ...rows.map(line)].join('\n')
}

/** By id, because a unit can be renamed mid-fight; by name only for logs that carry no ids. */
export const deathOf = (death: {id?: string; name: string}, unit: {id: string; name: string}) =>
	death.id ? death.id === unit.id : death.name === unit.name

const pad = (value: string | number, width: number) => String(value).padEnd(width)
const padStart = (value: string | number, width: number) => String(value).padStart(width)
const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`
const perSecond = (total: number, ms: number) => (total / (ms / 1000 || 1)).toFixed(1)
/** Shared with the Fight report panel so the terminal and the browser round the same way. */
export const percentOf = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '0%')
const avg = (numbers: number[]) => numbers.reduce((total, n) => total + n, 0) / (numbers.length || 1)

function count<T>(items: T[]) {
	const counts = new Map<T, number>()
	for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1)
	return counts
}
