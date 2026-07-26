/**
 * Simulate fights from the terminal.
 *
 *   bun run sim
 *   bun run sim --enemies TinyWolf*3 --policy panic
 *   bun run sim --party Tank --enemies Nakroth --repeat 20
 *   bun run sim --json > fight.json
 *
 * The game is a browser game, so we hand it a DOM before importing it. Nothing is drawn —
 * the UI just renders into a document nobody looks at.
 */
import {GlobalRegistrator} from '@happy-dom/global-registrator'
// Type-only, so it is erased and does not load the game before the DOM exists.
import type {FightResult} from '../src/sim'

GlobalRegistrator.register()

const {runFight, runFights, formatFight, formatAggregate, analyze, parseUnits, policies} = await import('../src/sim')

const args = parse(Bun.argv.slice(2))

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
  --json               print the report as JSON instead
`.trim(),
	)
	process.exit(0)
}

// parseUnits validates against the unit registry and throws with the list of known units.
const spec = {
	party: args.party ? parseUnits(String(args.party)) : undefined,
	enemies: args.enemies ? parseUnits(String(args.enemies)) : undefined,
	policy: (args.policy ?? 'triage') as keyof typeof policies,
	seed: Number(args.seed ?? 1),
	maxDuration: Number(args.duration ?? 120) * 1000,
}

if (!(spec.policy in policies)) {
	console.error(`Unknown policy "${spec.policy}". Known: ${Object.keys(policies).join(', ')}`)
	process.exit(1)
}

const repeat = Number(args.repeat ?? 0)

if (repeat > 1) {
	const results = await runFights(spec, repeat)
	if (args.json) {
		console.log(
			JSON.stringify(
				results.map((result) => ({...summary(result), report: analyze(result.events, result)})),
				null,
				2,
			),
		)
	} else {
		console.log(formatAggregate(results))
	}
} else {
	const result = await runFight(spec)
	if (args.json) {
		console.log(
			JSON.stringify({...summary(result), report: analyze(result.events, result), events: result.events}, null, 2),
		)
	} else {
		console.log(formatFight(result))
	}
}

process.exit(0)

function summary(result: FightResult) {
	return {seed: result.seed, outcome: result.outcome, duration: result.duration, roster: result.roster}
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
	return out as {[key: string]: string | undefined} & {help?: true; json?: true}
}
