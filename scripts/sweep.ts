/**
 * Sweep every roster against every policy over many seeds, and print one table.
 *
 *   bun run sweep
 *   bun run sweep --seeds 25
 *   bun run sweep --rosters 'TinyWolf*3, Nakroth' --policies triage,renew
 *
 * `bun run sim --repeat` answers "how does this one fight usually go". This answers the
 * question above it: is the difficulty curve the shape we think it is? One seed cannot tell a
 * balanced fight from a lucky roll, and a single roster cannot tell you that the boss is easier
 * than three trash mobs — which is exactly what it was, and how #40 was found.
 *
 * Read the `idle` row first. A policy that wins with `idle` is a fight healing does not decide,
 * so a retune that lifts a win rate by making the healer irrelevant shows up here as `idle`
 * climbing alongside `triage` rather than staying at 0%.
 *
 * The game is a browser game, so we hand it a DOM before importing it.
 */
import {GlobalRegistrator} from '@happy-dom/global-registrator'
// Type-only, so it is erased and does not load the game before the DOM exists.
import type {FightResult} from '../src/sim'

GlobalRegistrator.register()

const {runFight, analyze, parseUnits, policies} = await import('../src/sim')

const args = parse(Bun.argv.slice(2))

if (args.help) {
	console.log(
		`
bun run sweep [options]

  --rosters  <list>    semicolon-separated enemy groups, "Name*3" to repeat
                       (default: TinyWolf; TinyWolf*2; TinyWolf*3; TinyWolf*5; Nakroth; Nakroth, TinyWolf*2)
  --policies <list>    comma separated (default all: ${Object.keys(policies).join(', ')})
  --seeds    <n>       how many seeds per combination, starting at 1 (default 10)
  --duration <s>       give up after n seconds of fight time (default 120)
  --json               print rows as JSON instead of a table
`.trim(),
	)
	process.exit(0)
}

const DEFAULT_ROSTERS = 'TinyWolf; TinyWolf*2; TinyWolf*3; TinyWolf*5; Nakroth; Nakroth, TinyWolf*2'

const rosters = (text('rosters') ?? DEFAULT_ROSTERS)
	.split(';')
	.map((entry) => entry.trim())
	.filter(Boolean)
	// parseUnits validates against the unit registry and throws with the list of known units.
	.map((entry) => ({label: entry, enemies: parseUnits(entry)}))

const policyNames = (text('policies') ?? Object.keys(policies).join(','))
	.split(',')
	.map((name) => name.trim())
	.filter(Boolean)

for (const name of policyNames) {
	if (!(name in policies)) bail(`Unknown policy "${name}". Known: ${Object.keys(policies).join(', ')}`)
}

const seeds = num('seeds', 10)
const maxDuration = num('duration', 120) * 1000

interface Row {
	roster: string
	policy: string
	winPercent: number
	timeoutPercent: number
	medianDuration: number
	hps: number
	overhealPercent: number
	manaPerSecond: number
	castsPerFight: number
}

const rows: Row[] = []

for (const roster of rosters) {
	for (const policy of policyNames) {
		let victories = 0
		let timeouts = 0
		let healing = 0
		let overhealing = 0
		let mana = 0
		let casts = 0
		const durations: number[] = []

		for (let seed = 1; seed <= seeds; seed++) {
			const result: FightResult = await runFight({
				enemies: roster.enemies,
				policy: policy as keyof typeof policies,
				seed,
				maxDuration,
			})
			const report = analyze(result.events, result)

			if (result.outcome === 'victory') victories++
			if (result.outcome === 'timeout') timeouts++
			durations.push(result.duration)
			healing += report.totals.healing
			overhealing += report.totals.overhealing

			// The healer is the actor the policy drives; everyone else is scenery here.
			const healer = report.actors.find((actor) => actor.id === result.roster.find((u) => u.name === 'Player')?.id)
			mana += healer?.manaSpent ?? 0
			casts += healer?.casts ?? 0
		}

		const seconds = durations.reduce((a, b) => a + b, 0) / 1000
		const landed = healing + overhealing
		rows.push({
			roster: roster.label,
			policy,
			winPercent: percent(victories, seeds),
			timeoutPercent: percent(timeouts, seeds),
			medianDuration: median(durations),
			hps: seconds ? round(healing / seconds) : 0,
			overhealPercent: landed ? percent(overhealing, landed) : 0,
			manaPerSecond: seconds ? round(mana / seconds) : 0,
			castsPerFight: round(casts / seeds),
		})
		// Progress on stderr, so `--json > file` stays valid.
		console.error(`${roster.label} / ${policy}`)
	}
}

if (args.json) {
	console.log(JSON.stringify({seeds, rows}, null, 2))
} else {
	console.log(table(rows))
}

process.exit(0)

function table(rows: Row[]) {
	const header = ['roster', 'policy', 'win%', 'timeout%', 'median', 'hps', 'overheal%', 'mana/s', 'casts']
	const body = rows.map((row) => [
		row.roster,
		row.policy,
		`${row.winPercent}%`,
		`${row.timeoutPercent}%`,
		`${(row.medianDuration / 1000).toFixed(1)}s`,
		row.hps.toFixed(1),
		`${row.overhealPercent}%`,
		row.manaPerSecond.toFixed(1),
		row.castsPerFight.toFixed(1),
	])
	const widths = header.map((_, i) => Math.max(header[i].length, ...body.map((cells) => cells[i].length)))
	const line = (cells: string[]) => cells.map((cell, i) => cell.padEnd(widths[i])).join('  ')
	return [line(header), widths.map((w) => '-'.repeat(w)).join('  '), ...body.map(line)].join('\n')
}

function median(values: number[]) {
	const sorted = [...values].sort((a, b) => a - b)
	return sorted[Math.floor(sorted.length / 2)] ?? 0
}

// Declarations, not `const` arrows: these are called from the sweep loop above, and a `const`
// is not hoisted.
function percent(part: number, whole: number) {
	return Math.round((part / whole) * 100)
}

function round(value: number) {
	return Math.round(value * 10) / 10
}

function parse(argv: string[]) {
	const out: Record<string, string | true> = {}
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i]
		if (!arg.startsWith('--')) continue
		const key = arg.slice(2)
		const next = argv[i + 1]
		if (!next || next.startsWith('--')) out[key] = true
		else {
			out[key] = next
			i++
		}
	}
	return out
}

/** A flag that needs a value. `--seeds` alone parses as `true`, and `Number(true)` is 1. */
function text(name: string) {
	const raw = args[name]
	if (raw === undefined) return undefined
	if (raw === true) bail(`--${name} needs a value`)
	return raw
}

function num(name: string, fallback: number) {
	const raw = text(name)
	if (raw === undefined) return fallback
	const value = Number(raw)
	if (!Number.isFinite(value)) bail(`--${name} needs a number, got "${raw}"`)
	return value
}

function bail(message: string): never {
	console.error(message)
	process.exit(1)
}
