/**
 * Sweep every enemy group against every policy over many seeds, and print one table.
 *
 *   bun run sweep
 *   bun run sweep --seeds 25
 *   bun run sweep --enemies 'TinyWolf*3, Nakroth' --policies triage,renew
 *   bun run sweep --seeds 200 --enemies 'TinyWolf*4' --tune 'aura:Rend.total=-16'
 *
 * `bun run sim --repeat` answers "how does this one fight usually go". This answers the
 * question above it: is the difficulty curve the shape we think it is? One seed cannot tell a
 * balanced fight from a lucky roll, and a single enemy group cannot tell you that the boss is
 * easier than three ordinary enemies — which is exactly what it was, and how #40 was found.
 *
 * Read the `idle` row first. A policy that wins with `idle` is a fight healing does not decide,
 * so a retune that lifts a win rate by making the healer irrelevant shows up here as `idle`
 * climbing alongside `triage` rather than staying at 0%.
 *
 * Then read `±` before believing any comparison. A win rate is a coin flip counted a few times,
 * and at the default seed count a five-point difference is nothing at all.
 *
 * The game is a browser game, so we hand it a DOM before importing it.
 */
import {GlobalRegistrator} from '@happy-dom/global-registrator'
// Type-only, so it is erased and does not load the game before the DOM exists.
import type {FightResult} from '../src/sim'
import {cli, bail, attempt} from './cli'

GlobalRegistrator.register()

const {runFight, analyze, healerOf, partyInjuredTime, margin, parseUnits, policies, applyTunes, formatTune} =
	await import('../src/sim')

const {text, num, all, flag} = cli(Bun.argv.slice(2))

/**
 * The standard grid. Every wolf count from one to five, because the curve is quadratic on purpose
 * and the interesting cells are the ones that are neither hopeless nor free — at four wolves
 * `renew` is the only policy still moving, which makes it the row a retune shows up in first.
 */
const DEFAULT_ENEMIES =
	'TinyWolf; TinyWolf*2; TinyWolf*3; TinyWolf*4; TinyWolf*5; TinyWolf*2, WolfShaman; Nakroth; Nakroth, TinyWolf*2'

if (flag('help')) {
	console.log(
		`
bun run sweep [options]

  --enemies  <list>    semicolon-separated enemy groups, "Name*3" to repeat
                       (default: ${DEFAULT_ENEMIES})
  --policies <list>    comma separated (default all: ${Object.keys(policies).join(', ')})
  --seeds    <n>       how many seeds per combination, starting at 1 (default 10)
  --duration <s>       give up after n seconds of fight time (default 120)
  --tune     <spec>    change a balance number first, e.g. 'aura:Rend.total=-16'
                       kind:Name.key=value — spell, attack, aura or unit. Repeatable.
  --json               print rows as JSON instead of a table

  10 seeds shows a shape; comparing two candidates needs about 200. See the note the
  table prints under itself.
`.trim(),
	)
	process.exit(0)
}

// Throws on an unknown name or key rather than measuring the baseline and calling it a result.
const tuned = attempt(() => applyTunes(all('tune')).map(formatTune))

const enemyGroups = attempt(() =>
	(text('enemies') ?? DEFAULT_ENEMIES)
		.split(';')
		.map((entry) => entry.trim())
		.filter(Boolean)
		// parseUnits validates against the unit registry and throws with the list of known units.
		.map((entry) => ({label: entry, enemies: parseUnits(entry)})),
)

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
	enemies: string
	policy: string
	winPercent: number
	/** Half-width of the 95% interval on `winPercent`, in points. */
	winMargin: number
	timeoutPercent: number
	medianDuration: number
	hps: number
	overhealPercent: number
	manaPerSecond: number
	castsPerFight: number
	/** Share of the fight the healer spent committed to a cast or its global cooldown. */
	busyPercent: number
	/**
	 * Share of the fight the party's worst-off member spent below the injured line.
	 *
	 * Read next to `win%`: a policy that wins at 0% hurt was never tested, and an enemy group where
	 * even `idle` stays near 0% is not a fight, it is a waiting room. A retune that raises win rates by
	 * lowering this made the fight easier; one that leaves it alone made the healer better.
	 */
	hurtPercent: number
}

/**
 * One fight, reduced to the numbers the table adds up. The healer's own, not the fight's:
 * `totals.healing` counts every faction, so the moment an enemy healer joined an enemy group the
 * `idle` control group started reporting 6 hps, and a control group that heals is not one.
 */
interface Fight {
	outcome: FightResult['outcome']
	duration: number
	healing: number
	overhealing: number
	mana: number
	casts: number
	busy: number
	hurt: number
}

const rows: Row[] = []

for (const group of enemyGroups) {
	for (const policy of policyNames) {
		const fights: Fight[] = []

		for (let seed = 1; seed <= seeds; seed++) {
			const result: FightResult = await runFight({
				enemies: group.enemies,
				policy: policy as keyof typeof policies,
				seed,
				maxDuration,
			})
			const report = analyze(result.events, result)
			const healer = healerOf(report)
			fights.push({
				outcome: result.outcome,
				duration: result.duration,
				healing: healer?.healingDone ?? 0,
				overhealing: healer?.overhealing ?? 0,
				mana: healer?.manaSpent ?? 0,
				casts: healer?.casts ?? 0,
				busy: healer?.busyTime ?? 0,
				// The party's, not the healer's: the question is whether anyone was in danger.
				hurt: partyInjuredTime(report),
			})
		}

		const sum = (pick: (fight: Fight) => number) => fights.reduce((total, fight) => total + pick(fight), 0)
		const wins = fights.filter((f) => f.outcome === 'victory').length
		const totalMs = sum((f) => f.duration)
		const seconds = totalMs / 1000
		const healing = sum((f) => f.healing)
		const overhealing = sum((f) => f.overhealing)
		const busy = sum((f) => f.busy)
		const landed = healing + overhealing
		rows.push({
			enemies: group.label,
			policy,
			winPercent: percent(wins, seeds),
			winMargin: margin(wins, seeds),
			timeoutPercent: percent(fights.filter((f) => f.outcome === 'timeout').length, seeds),
			medianDuration: median(fights.map((f) => f.duration)),
			hps: seconds ? round(healing / seconds) : 0,
			overhealPercent: landed ? percent(overhealing, landed) : 0,
			manaPerSecond: seconds ? round(sum((f) => f.mana) / seconds) : 0,
			castsPerFight: round(sum((f) => f.casts) / seeds),
			busyPercent: totalMs ? percent(busy, totalMs) : 0,
			hurtPercent: totalMs
				? percent(
						sum((f) => f.hurt),
						totalMs,
					)
				: 0,
		})
		// Progress on stderr, so `--json > file` stays valid.
		console.error(`${group.label} / ${policy}`)
	}
}

if (flag('json')) {
	console.log(JSON.stringify({seeds, tuned, rows}, null, 2))
} else {
	console.log(table(rows))
	console.log(note(rows))
}

process.exit(0)

function table(rows: Row[]) {
	const header = [
		'enemies',
		'policy',
		'win%',
		'±',
		'hurt%',
		'timeout%',
		'median',
		'hps',
		'overheal%',
		'mana/s',
		'busy%',
		'casts',
	]
	const body = rows.map((row) => [
		row.enemies,
		row.policy,
		`${row.winPercent}%`,
		`${row.winMargin}`,
		`${row.hurtPercent}%`,
		`${row.timeoutPercent}%`,
		`${(row.medianDuration / 1000).toFixed(1)}s`,
		row.hps.toFixed(1),
		`${row.overhealPercent}%`,
		row.manaPerSecond.toFixed(1),
		`${row.busyPercent}%`,
		row.castsPerFight.toFixed(1),
	])
	const widths = header.map((_, i) => Math.max(header[i].length, ...body.map((cells) => cells[i].length)))
	const line = (cells: string[]) => cells.map((cell, i) => cell.padEnd(widths[i])).join('  ')
	return [line(header), widths.map((w) => '-'.repeat(w)).join('  '), ...body.map(line)].join('\n')
}

/**
 * The warning label. Printed with the table rather than left in a doc, because the mistake it
 * prevents is made while reading the table: two runs of the same sweep differ by more than most
 * retunes do, and a win rate that moved five points at ten seeds has not moved.
 */
function note(rows: Row[]) {
	const widest = Math.max(...rows.map((row) => row.winMargin))
	const lines = [
		'',
		`  ${seeds} seeds per cell. ± is the 95% interval on win%, up to ${widest} points wide here:`,
		'  two cells whose ranges overlap are not different, however different they look.',
		'  Comparing candidates needs roughly 200 seeds; 10 is for seeing the shape.',
	]
	if (tuned.length) lines.push('', `  tuned  ${tuned.join('  ')}`)
	return lines.join('\n')
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
