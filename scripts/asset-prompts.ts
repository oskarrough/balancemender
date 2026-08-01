type AssetType = 'spell' | 'character' | 'scene'

const assetTypes: AssetType[] = ['spell', 'character', 'scene']

const typeConfig: Record<AssetType, {folder: string; renderRequirements: string}> = {
	spell: {
		folder: 'spells',
		renderRequirements: 'square image, no text, no watermark, no border',
	},
	character: {
		folder: 'characters',
		renderRequirements: 'square image, no text, no watermark, no border',
	},
	scene: {
		folder: 'explorations',
		renderRequirements: 'wide 16:9 image at 1440x810, no text, no watermark, no border',
	},
}

type SceneVariant = {suffix: string; size: string; render: string; prompt: string}

type Asset = {
	id: string
	type: AssetType
	name: string
	prompt: string
	/** Scenes only: how the same room is recomposed for a narrow screen. */
	portrait?: string
}

type Manifest = {
	project: string
	style: string
	types: Record<AssetType, string>
	sceneVariants: Record<'landscape' | 'portrait', SceneVariant>
	assets: Asset[]
}

const manifest = (await Bun.file(new URL('../assets/image-assets.json', import.meta.url)).json()) as Manifest
const args = Bun.argv.slice(2)
const variantNames = ['landscape', 'portrait'] as const
type VariantName = (typeof variantNames)[number]

const ids: string[] = []
let list = false
let type: string | undefined
let variant: string | undefined

for (let index = 0; index < args.length; index++) {
	const arg = args[index]
	if (arg === '--list') {
		list = true
		continue
	}
	if (arg === '--type') {
		type = args[index + 1]
		if (type === undefined) throw new Error('--type must be ' + assetTypes.join(', '))
		index++
		continue
	}
	if (arg === '--variant') {
		variant = args[index + 1]
		if (variant === undefined) throw new Error('--variant must be ' + variantNames.join(', '))
		index++
		continue
	}
	ids.push(arg)
}

if (type !== undefined && !assetTypes.includes(type as AssetType)) {
	throw new Error('--type must be ' + assetTypes.join(', '))
}
if (variant !== undefined && !variantNames.includes(variant as VariantName)) {
	throw new Error('--variant must be ' + variantNames.join(', '))
}

/**
 * One job is one image. Everything is a single image except a scene, which is one room painted
 * twice — the wide view and the tall one — from the same room prompt plus a recomposition note.
 */
type Job = {asset: Asset; variant?: SceneVariant}

function jobs(asset: Asset): Job[] {
	if (asset.type !== 'scene') return [{asset}]
	return variantNames
		.filter((name) => !variant || name === variant)
		.map((name) => ({asset, variant: manifest.sceneVariants[name]}))
}

function outputPath(job: Job) {
	const {asset} = job
	const suffix = job.variant?.suffix ?? ''
	return '/assets/generated/' + typeConfig[asset.type].folder + '/' + asset.id + suffix + '.png'
}

function compose(job: Job) {
	const {asset} = job
	const typePrompt = [manifest.types[asset.type], job.variant?.prompt].filter(Boolean).join(' ')
	const individual = [asset.prompt, job.variant?.suffix ? asset.portrait : undefined].filter(Boolean).join(' ')
	return [
		'Create one production game asset for ' + manifest.project + '.',
		'',
		'Asset name: ' + asset.name,
		'Asset type: ' + asset.type,
		'Output target: public' + outputPath(job),
		'',
		'Stylistic prompt: ' + manifest.style,
		'Type prompt: ' + typePrompt,
		'Individual prompt: ' + individual,
		'',
		'Render requirements: ' +
			(job.variant?.render ?? typeConfig[asset.type].renderRequirements) +
			'. Use gpt-image-2/Codex image generation. Generate, then write the image to the output target path at exactly ' +
			'that size. There is no approval step to wait for — the picture is judged in the repo, and an unwritten ' +
			'candidate is a lost one.',
	].join('\n')
}

let assets = manifest.assets

if (type) assets = assets.filter((asset) => asset.type === (type as AssetType))
if (ids.length > 0) {
	const wanted = new Set(ids)
	assets = assets.filter((asset) => wanted.has(asset.id))
	const found = new Set(assets.map((asset) => asset.id))
	const missing = ids.filter((id) => !found.has(id))
	if (missing.length > 0) throw new Error('Unknown asset id: ' + missing.join(', '))
}

const queue = assets.flatMap(jobs)

if (list) {
	for (const job of queue)
		console.log(job.asset.id + '\t' + job.asset.type + '\t' + job.asset.name + '\tpublic' + outputPath(job))
	process.exit(0)
}

if (queue.length === 0) {
	console.log(
		'Usage: bun run asset:prompt -- [--list] [--type spell|character|scene] [--variant landscape|portrait] [asset-id...]',
	)
	process.exit(0)
}

console.log(queue.map(compose).join('\n\n---\n\n'))
