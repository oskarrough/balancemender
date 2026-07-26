import {analyze, FightReport, Series} from './report'
import type {FightResult, Outcome} from './run'

/** Plain-text fight reports. No colours, so they pipe and diff cleanly. */

const BLOCKS = '▁▂▃▄▅▆▇█'
const OUTCOMES: Outcome[] = ['victory', 'defeat', 'timeout']

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
	const party = result.spec.party ?? ['Tank']
	const enemies = result.spec.enemies ?? ['TinyWolf']
	const policy = typeof result.spec.policy === 'string' ? result.spec.policy : (result.spec.policy?.name ?? 'triage')

	lines.push(
		`${[...party, 'Player'].join(' + ')}  vs  ${enemies.join(' + ')}`,
		`seed ${result.seed} · ${policy} · ${result.outcome} in ${seconds(result.duration)}`,
		'',
	)

	const nameWidth = Math.max(...report.health.map((s) => s.name.length), 10)
	for (const unit of report.health) {
		lines.push(`  ${pad(unit.name, nameWidth)}  ${sparkline(unit.points)}  ${endState(unit, report)}`)
	}

	lines.push(
		'',
		table(
			['actor', 'dmg', 'dps', 'heal', 'hps', 'overheal', 'taken', 'casts'],
			report.actors.map((a) => [
				a.name,
				a.damageDone,
				perSecond(a.damageDone, report.duration),
				a.healingDone,
				perSecond(a.healingDone, report.duration),
				percentOf(a.overhealing, a.healingDone + a.overhealing),
				a.damageTaken,
				a.casts,
			]),
		),
	)

	if (report.spells.length) {
		lines.push(
			'',
			table(
				['spell', 'casts', 'hits', 'total', 'avg', 'overheal'],
				report.spells.map((s) => [s.name, s.casts, s.hits, s.total, s.avg, percentOf(s.overheal, s.total)]),
			),
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
	const durations = results.map((r) => r.duration)
	const outcomes = count(results.map((r) => r.outcome))
	const deaths = count(reports.flatMap((r) => r.deaths.map((d) => d.name)))
	const spec = results[0].spec
	const policy = typeof spec.policy === 'string' ? spec.policy : (spec.policy?.name ?? 'triage')

	const lines = [
		`${results.length} fights · ${[...(spec.party ?? ['Tank']), 'Player'].join(' + ')} vs ${(spec.enemies ?? ['TinyWolf']).join(' + ')} · ${policy}`,
		'',
		'  ' +
			OUTCOMES.map(
				(key) => `${key} ${outcomes.get(key) ?? 0} (${Math.round(((outcomes.get(key) ?? 0) / results.length) * 100)}%)`,
			).join('   '),
		`  duration  avg ${seconds(avg(durations))}  min ${seconds(Math.min(...durations))}  max ${seconds(Math.max(...durations))}`,
		`  healing   avg ${avg(reports.map((r) => r.totals.hps)).toFixed(1)} hps  overheal ${percentOf(
			avg(reports.map((r) => r.totals.overhealing)),
			avg(reports.map((r) => r.totals.overhealing + r.totals.healing)),
		)}`,
		`  damage    avg ${avg(reports.map((r) => r.totals.dps)).toFixed(1)} dps`,
	]
	if (deaths.size) {
		lines.push(`  deaths    ${[...deaths].map(([name, n]) => `${name} ${n}/${results.length}`).join('   ')}`)
	}
	return lines.join('\n')
}

function endState(unit: Series, report: FightReport) {
	const death = report.deaths.find((d) => d.name === unit.name)
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

const pad = (value: string | number, width: number) => String(value).padEnd(width)
const padStart = (value: string | number, width: number) => String(value).padStart(width)
const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`
const perSecond = (total: number, ms: number) => (total / (ms / 1000 || 1)).toFixed(1)
const percentOf = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '0%')
const avg = (numbers: number[]) => numbers.reduce((total, n) => total + n, 0) / (numbers.length || 1)

function count<T>(items: T[]) {
	const counts = new Map<T, number>()
	for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1)
	return counts
}
