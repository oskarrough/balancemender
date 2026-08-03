/** Compare bots and balance variants against one exact authored room. */
import {parseArgs} from 'node:util'
import {
	applyTunes,
	authoredRoom,
	bots,
	formatBenchmark,
	formatTune,
	resetBalance,
	runFights,
	summarizeBenchmark,
	type BenchmarkRow,
	type BotName,
} from '../src/sim'
import {attempt, bail, num} from './cli'

const DEFAULT_BOTS = 'idle,triage,renew,panic'

interface Variant {
	name: string
	specs: string[]
	tuned: string[]
}

const baseline: Variant = {name: 'baseline', specs: [], tuned: []}

const {values: args} = attempt(() =>
	parseArgs({
		args: Bun.argv.slice(2),
		options: {
			room: {type: 'string'},
			bots: {type: 'string'},
			seed: {type: 'string'},
			seeds: {type: 'string'},
			duration: {type: 'string'},
			variant: {type: 'string', multiple: true},
			json: {type: 'boolean'},
			help: {type: 'boolean'},
		},
	}),
)

if (args.help) {
	console.log(
		`
bun run bench --room <id> [options]

  --room     <id>      authored room id, e.g. green-howling (required)
  --bots     <list>    comma separated (default ${DEFAULT_BOTS})
  --seed     <n>       first deterministic seed (default 1)
  --seeds    <n>       fights per bot and variant (default 10; compare with 200)
  --duration <s>       give up after n seconds of fight time (default 120)
  --variant  <v=tunes> named candidate; comma-separate tunes and repeat the flag
                       e.g. --variant 'harder=effect:Rile.frenzy.coefficient=0.2'
  --json               print compact summary JSON; never includes combat events

The baseline is always included. Outcome rows separate wins from clean wins and victories
after the Player fell; the pressure table shows who took the hits and damage.
`.trim(),
	)
	process.exit(0)
}

if (!args.room) bail('--room is required')
const scenario = attempt(() => authoredRoom(args.room!))
const botNames = (args.bots ?? DEFAULT_BOTS)
	.split(',')
	.map((name) => name.trim())
	.filter(Boolean) as BotName[]
if (!botNames.length) bail('--bots needs at least one bot')
for (const bot of botNames) if (!(bot in bots)) bail(`Unknown bot "${bot}". Known: ${Object.keys(bots).join(', ')}`)

const seeds = num('seeds', args.seeds, 10)
if (seeds < 1) bail(`--seeds must be at least 1, got ${seeds}`)
const firstSeed = num('seed', args.seed, 1)
const maxDuration = num('duration', args.duration, 120) * 1000
const variants = attempt(() => [baseline, ...(args.variant ?? []).map(parseVariant)])
if (new Set(variants.map((variant) => variant.name)).size !== variants.length) bail('Variant names must be unique')

const rows: BenchmarkRow[] = []
try {
	for (const variant of variants) {
		resetBalance()
		applyTunes(variant.specs)
		for (const bot of botNames) {
			const results = await runFights({...scenario.trial, bot, seed: firstSeed, maxDuration}, seeds)
			rows.push(summarizeBenchmark(results, variant.name, bot))
			console.error(`${variant.name} / ${bot}`)
		}
	}
} finally {
	resetBalance()
}

if (args.json) {
	console.log(JSON.stringify({room: scenario.id, label: scenario.label, seeds, variants, rows}, null, 2))
} else {
	console.log(formatBenchmark(scenario.label, seeds, rows))
	if (variants.length > 1) {
		console.log(
			`\nvariants\n${variants.map((variant) => `  ${variant.name}  ${variant.tuned.join('  ') || 'shipped balance'}`).join('\n')}`,
		)
	}
}

process.exit(0)

function parseVariant(raw: string): Variant {
	const equals = raw.indexOf('=')
	const name = raw.slice(0, equals).trim()
	const specs = raw
		.slice(equals + 1)
		.split(',')
		.map((spec) => spec.trim())
		.filter(Boolean)
	if (equals < 1 || !name || !specs.length) {
		throw new Error(`Bad variant "${raw}". Expected name=kind:Name.key=value`)
	}
	const tunes = applyTunes(specs)
	resetBalance()
	return {name, specs, tuned: tunes.map(formatTune)}
}
