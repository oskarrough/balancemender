import {formatFightTime} from '../utils'
import {analyze, healerOf, margin, partyInjuredTime} from './report'
import type {FightResult} from './run'

export interface PressureRow {
	unit: string
	survivalPercent: number
	hitSharePercent: number
	damageSharePercent: number
	averageDamageTaken: number
	hurtPercent: number
}

export interface BenchmarkRow {
	variant: string
	bot: string
	fights: number
	winPercent: number
	winMargin: number
	cleanWinPercent: number
	playerSurvivalPercent: number
	partySurvivalPercent: number
	victoryAfterPlayerFallPercent: number
	timeoutPercent: number
	medianDuration: number
	hurtPercent: number
	busyPercent: number
	averageEndMana: number
	pressure: PressureRow[]
}

/** Reduce repeated fights to the outcomes and targeting pressure used to compare balance candidates. */
export function summarizeBenchmark(results: FightResult[], variant: string, bot: string): BenchmarkRow {
	if (!results.length) throw new Error('A benchmark needs at least one fight')
	const reports = results.map((result) => analyze(result.events, result))
	const partySize = results[0].units.filter((unit) => unit.faction === 'party').length
	const playerAlive = reports.map((report) => healerOf(report)?.deathTime === undefined)
	const wins = results.filter((result) => result.outcome === 'victory').length
	const totalDuration = sum(results, (result) => result.duration)
	const cleanWins = results.filter(
		(result) => result.outcome === 'victory' && result.survivors.party === partySize,
	).length

	return {
		variant,
		bot,
		fights: results.length,
		winPercent: percent(wins, results.length),
		winMargin: margin(wins, results.length),
		cleanWinPercent: percent(cleanWins, results.length),
		playerSurvivalPercent: percent(playerAlive.filter(Boolean).length, results.length),
		partySurvivalPercent: percent(
			results.filter((result) => result.survivors.party === partySize).length,
			results.length,
		),
		victoryAfterPlayerFallPercent: percent(
			results.filter((result, index) => result.outcome === 'victory' && !playerAlive[index]).length,
			results.length,
		),
		timeoutPercent: percent(results.filter((result) => result.outcome === 'timeout').length, results.length),
		medianDuration: median(results.map((result) => result.duration)),
		hurtPercent: percent(sum(reports, partyInjuredTime), totalDuration),
		busyPercent: percent(
			sum(reports, (report) => healerOf(report)?.busyTime ?? 0),
			totalDuration,
		),
		averageEndMana: round(average(reports.map((report) => healerOf(report)?.endMana ?? 0))),
		pressure: pressure(results, reports, totalDuration),
	}
}

export function formatBenchmark(label: string, seeds: number, rows: BenchmarkRow[]) {
	const outcomes = table(
		[
			'variant',
			'bot',
			'win%',
			'±',
			'clean%',
			'player%',
			'party%',
			'after fall%',
			'timeout%',
			'median',
			'hurt%',
			'busy%',
			'mana',
		],
		rows.map((row) => [
			row.variant,
			row.bot,
			`${row.winPercent}%`,
			row.winMargin,
			`${row.cleanWinPercent}%`,
			`${row.playerSurvivalPercent}%`,
			`${row.partySurvivalPercent}%`,
			`${row.victoryAfterPlayerFallPercent}%`,
			`${row.timeoutPercent}%`,
			formatFightTime(row.medianDuration),
			`${row.hurtPercent}%`,
			`${row.busyPercent}%`,
			row.averageEndMana,
		]),
	)
	const pressure = table(
		['variant', 'bot', 'unit', 'survive%', 'hits%', 'damage%', 'avg taken', 'hurt%'],
		rows.flatMap((row) =>
			row.pressure.map((unit) => [
				row.variant,
				row.bot,
				unit.unit,
				`${unit.survivalPercent}%`,
				`${unit.hitSharePercent}%`,
				`${unit.damageSharePercent}%`,
				unit.averageDamageTaken,
				`${unit.hurtPercent}%`,
			]),
		),
	)

	return `${label} · ${seeds} seeds\n\n${outcomes}\n\npressure\n${pressure}`
}

function pressure(results: FightResult[], reports: ReturnType<typeof analyze>[], totalDuration: number) {
	const names = results[0].units.filter((unit) => unit.faction === 'party').map((unit) => unit.name)
	const stats = names.map((name) => reports.map((report) => report.units.find((unit) => unit.name === name)!))
	const totalHits = sum(stats.flat(), (unit) => unit.hitsTaken)
	const totalDamage = sum(stats.flat(), (unit) => unit.damageTaken)

	return names.map((name, index) => {
		const units = stats[index]
		return {
			unit: name,
			survivalPercent: percent(units.filter((unit) => unit.deathTime === undefined).length, results.length),
			hitSharePercent: percent(
				sum(units, (unit) => unit.hitsTaken),
				totalHits,
			),
			damageSharePercent: percent(
				sum(units, (unit) => unit.damageTaken),
				totalDamage,
			),
			averageDamageTaken: round(average(units.map((unit) => unit.damageTaken))),
			hurtPercent: percent(
				sum(units, (unit) => unit.injuredTime),
				totalDuration,
			),
		}
	})
}

function table(headers: string[], rows: (string | number)[][]) {
	const widths = headers.map((header, index) =>
		Math.max(header.length, ...rows.map((row) => String(row[index]).length)),
	)
	const line = (cells: (string | number)[]) => cells.map((cell, index) => String(cell).padEnd(widths[index])).join('  ')
	return [line(headers), widths.map((width) => '-'.repeat(width)).join('  '), ...rows.map(line)].join('\n')
}

const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0)
const average = (values: number[]) => sum(values, (value) => value) / (values.length || 1)
const round = (value: number) => Math.round(value * 10) / 10

function median(values: number[]) {
	const sorted = [...values].sort((a, b) => a - b)
	return sorted[Math.floor(sorted.length / 2)] ?? 0
}

function sum<T>(items: readonly T[], pick: (item: T) => number) {
	return items.reduce((total, item) => total + pick(item), 0)
}
