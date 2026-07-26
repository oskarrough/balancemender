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
const party = text('party')
const enemies = text('enemies')
const spec = {
	party: party ? parseUnits(party) : undefined,
	enemies: enemies ? parseUnits(enemies) : undefined,
	policy: (text('policy') ?? 'triage') as keyof typeof policies,
	seed: num('seed', 1),
	maxDuration: num('duration', 120) * 1000,
}

if (!(spec.policy in policies)) {
	bail(`Unknown policy "${spec.policy}". Known: ${Object.keys(policies).join(', ')}`)
}

const repeat = num('repeat', 0)

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
	return out
}

/**
 * A flag that needs a value. `--seed` on its own parses as `true`, and `Number(true)` is 1 —
 * so without these checks a typo silently runs a different fight than you asked for.
 */
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
