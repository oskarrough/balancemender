/**
 * Simulate fights from the terminal.
 *
 *   bun run sim
 *   bun run sim --enemies TinyWolf*3 --policy panic
 *   bun run sim --party Tank --enemies Nakroth --repeat 20
 *   bun run sim --repeat 20 --tune 'spell:Heal.cost=40'
 *   bun run sim --json > fight.json
 *
 * The game is a browser game, so we hand it a DOM before importing it. Nothing is drawn —
 * the UI just renders into a document nobody looks at.
 */
import {GlobalRegistrator} from '@happy-dom/global-registrator'
// Type-only, so it is erased and does not load the game before the DOM exists.
import type {FightResult} from '../src/sim'
import {cli, bail, attempt} from './cli'

GlobalRegistrator.register()

const {runFight, runFights, formatFight, formatAggregate, analyze, parseUnits, policies, applyTunes, formatTune} =
	await import('../src/sim')

const {text, num, all, flag} = cli(Bun.argv.slice(2))

if (flag('help')) {
	console.log(
		`
bun run sim [options]

  --party    <units>   allies besides you, comma separated (default Tank)
  --enemies  <units>   enemies, comma separated, "Name*3" to repeat (default TinyWolf)
  --policy   <name>    how the healer plays: ${Object.keys(policies).join(', ')} (default triage)
  --seed     <n>       dice seed; the same seed always plays out the same (default 1)
  --repeat   <n>       run n fights and summarise them
  --duration <s>       give up after n seconds of fight time (default 120)
  --tune     <spec>    change a balance number first, e.g. 'spell:Heal.cost=40'
                       kind:Name.key=value — spell, attack, effect or unit. Repeatable.
  --json               print the report as JSON instead

  Redirect --json to a file rather than piping it. A fight's events run to hundreds of
  kilobytes and a pipe truncates mid-object, which reads as a JSON parse error.
`.trim(),
	)
	process.exit(0)
}

// Throws on an unknown name or key rather than measuring the baseline and calling it a result.
const tuned = attempt(() => applyTunes(all('tune')).map(formatTune))

// parseUnits validates against the unit registry and throws with the list of known units.
const party = text('party')
const enemies = text('enemies')
const spec = attempt(() => ({
	party: party ? parseUnits(party) : undefined,
	enemies: enemies ? parseUnits(enemies) : undefined,
	policy: (text('policy') ?? 'triage') as keyof typeof policies,
	seed: num('seed', 1),
	maxDuration: num('duration', 120) * 1000,
}))

if (!(spec.policy in policies)) {
	bail(`Unknown policy "${spec.policy}". Known: ${Object.keys(policies).join(', ')}`)
}

const repeat = num('repeat', 0)

if (repeat > 1) {
	const results = await runFights(spec, repeat)
	if (flag('json')) {
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
	if (flag('json')) {
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
	return {seed: result.seed, outcome: result.outcome, duration: result.duration, roster: result.roster}
}
