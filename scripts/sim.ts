/**
 * Simulate fights from the terminal.
 *
 *   bun run sim
 *   bun run sim --enemies TinyWolf*3 --policy panic
 *   bun run sim --party Tank --enemies Nakroth --repeat 20
 *   bun run sim --repeat 20 --tune 'ability:Heal.cost=40'
 *   bun run sim --json > fight.json
 */
import {parseArgs} from 'node:util'
import {
	runFight,
	runFights,
	formatFight,
	formatAggregate,
	analyze,
	parseUnits,
	policies,
	applyTunes,
	formatTune,
	type FightResult,
} from '../src/sim'
import {bail, attempt, num} from './cli'

const {values: args} = attempt(() =>
	parseArgs({
		args: Bun.argv.slice(2),
		options: {
			party: {type: 'string'},
			enemies: {type: 'string'},
			policy: {type: 'string'},
			seed: {type: 'string'},
			repeat: {type: 'string'},
			duration: {type: 'string'},
			tune: {type: 'string', multiple: true},
			json: {type: 'boolean'},
			help: {type: 'boolean'},
		},
	}),
)

if (args.help) {
	console.log(
		`
bun run sim [options]

  --party    <units>   allies besides you, comma separated (default Tank)
  --enemies  <units>   enemies, comma separated, "Name*3" to repeat (default TinyWolf)
  --policy   <name>    how the healer plays: ${Object.keys(policies).join(', ')} (default triage)
  --seed     <n>       dice seed; the same seed always plays out the same (default 1)
  --repeat   <n>       run n fights and summarise them
  --duration <s>       give up after n seconds of fight time (default 120)
  --tune     <spec>    change a balance number first, e.g. 'ability:Heal.cost=40'
                       kind:Name.key=value — ability, cadence, aura, unit or rule. Repeatable.
  --json               print the report as JSON instead

  Redirect --json to a file rather than piping it. A fight's events run to hundreds of
  kilobytes and a pipe truncates mid-object, which reads as a JSON parse error.
`.trim(),
	)
	process.exit(0)
}

// Throws on an unknown name or key rather than measuring the baseline and calling it a result.
const tuned = attempt(() => applyTunes(args.tune ?? []).map(formatTune))

// parseUnits validates against the unit registry and throws with the list of known units.
const spec = attempt(() => ({
	party: args.party ? parseUnits(args.party) : undefined,
	enemies: args.enemies ? parseUnits(args.enemies) : undefined,
	policy: (args.policy ?? 'triage') as keyof typeof policies,
	seed: num('seed', args.seed, 1),
	maxDuration: num('duration', args.duration, 120) * 1000,
}))

if (!(spec.policy in policies)) {
	bail(`Unknown policy "${spec.policy}". Known: ${Object.keys(policies).join(', ')}`)
}

const repeat = num('repeat', args.repeat, 0)

if (repeat > 1) {
	const results = await runFights(spec, repeat)
	if (args.json) {
		console.log(
			JSON.stringify(
				{tuned, fights: results.map((result) => ({...summary(result), report: analyze(result.events, result)}))},
				null,
				2,
			),
		)
	} else {
		console.log(formatAggregate(results))
		printTunes()
	}
} else {
	const result = await runFight(spec)
	if (args.json) {
		console.log(
			JSON.stringify(
				{...summary(result), tuned, report: analyze(result.events, result), events: result.events},
				null,
				2,
			),
		)
	} else {
		console.log(formatFight(result))
		printTunes()
	}
}

process.exit(0)

/** Under the report, not above it: a result you cannot tell the tune from is a trap. */
function printTunes() {
	if (tuned.length) console.log(`\n  tuned     ${tuned.join('  ')}`)
}

function summary(result: FightResult) {
	return {seed: result.seed, outcome: result.outcome, duration: result.duration, units: result.units}
}
