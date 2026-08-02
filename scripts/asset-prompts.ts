import manifestJson from '../assets/image-assets.json'

export type AssetType = 'spell' | 'character' | 'scene'

export const assetTypes: AssetType[] = ['spell', 'character', 'scene']

export const typeConfig: Record<AssetType, {folder: string; size: string; renderRequirements: string}> = {
	spell: {
		folder: 'spells',
		size: '1024x1024',
		renderRequirements: 'square image at 1024x1024, no text, no watermark, no border',
	},
	character: {
		folder: 'characters',
		size: '1024x1024',
		renderRequirements: 'square image at 1024x1024, no text, no watermark, no border',
	},
	scene: {
		folder: 'explorations',
		size: '1440x810',
		renderRequirements: 'wide 16:9 image at 1440x810, no text, no watermark, no border',
	},
}

export type SceneVariant = {suffix: string; size: string; render: string; prompt: string}

export type Asset = {
	id: string
	type: AssetType
	name: string
	prompt: string
	/** Scenes only: how the same room is recomposed for a narrow screen. */
	portrait?: string
}

export type Manifest = {
	project: string
	style: string
	types: Record<AssetType, string>
	sceneVariants: Record<'landscape' | 'portrait', SceneVariant>
	assets: Asset[]
}

export const manifest = manifestJson as Manifest
export const variantNames = ['landscape', 'portrait'] as const
export type VariantName = (typeof variantNames)[number]

export type Job = {asset: Asset; variant?: SceneVariant}

export function findAsset(id: string): Asset {
	const asset = manifest.assets.find((candidate) => candidate.id === id)
	if (!asset) throw new Error('Unknown asset id: ' + id)
	return asset
}

/** A scene without a requested variant intentionally expands to both views. */
export function jobs(asset: Asset, variantName?: VariantName): Job[] {
	if (asset.type !== 'scene') return [{asset}]
	return variantNames
		.filter((name) => variantName === undefined || name === variantName)
		.map((name) => ({asset, variant: manifest.sceneVariants[name]}))
}

export function singleJob(asset: Asset, variantName?: VariantName): Job {
	if (asset.type === 'scene' && variantName === undefined) {
		throw new Error('Scene asset ' + asset.id + ' requires --variant landscape|portrait')
	}
	if (asset.type !== 'scene' && variantName !== undefined) {
		throw new Error('--variant is only valid for scene assets')
	}
	return jobs(asset, variantName)[0]
}

export function outputPath(job: Job): string {
	const suffix = job.variant?.suffix ?? ''
	return '/assets/generated/' + typeConfig[job.asset.type].folder + '/' + job.asset.id + suffix + '.png'
}

export function expectedSize(job: Job): {width: number; height: number} {
	const size = job.variant?.size ?? typeConfig[job.asset.type].size
	const match = /^(\d+)x(\d+)$/.exec(size)
	if (!match) throw new Error('Invalid image size in manifest: ' + size)
	return {width: Number(match[1]), height: Number(match[2])}
}

export function compose(job: Job, target = 'public' + outputPath(job)): string {
	const {asset} = job
	const typePrompt = [manifest.types[asset.type], job.variant?.prompt].filter(Boolean).join(' ')
	const individual = [asset.prompt, job.variant?.suffix ? asset.portrait : undefined].filter(Boolean).join(' ')
	return [
		'Create one production game asset for ' + manifest.project + '.',
		'',
		'Asset name: ' + asset.name,
		'Asset type: ' + asset.type,
		'Output target: ' + target,
		'',
		'Stylistic prompt: ' + manifest.style,
		'Type prompt: ' + typePrompt,
		'Individual prompt: ' + individual,
		'',
		'Render requirements: ' +
			(job.variant?.render ?? typeConfig[asset.type].renderRequirements) +
			'. Use gpt-image-2/Codex image generation. Generate exactly one candidate, write it to the output target ' +
			'path at exactly that size, validate the written file, and stop. Do not ask questions or wait for approval.',
	].join('\n')
}

function parseArgs(args: string[]) {
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
	return {ids, list, type: type as AssetType | undefined, variant: variant as VariantName | undefined}
}

export function runPromptCli(args: string[]): void {
	const options = parseArgs(args)
	let assets = manifest.assets

	if (options.type) assets = assets.filter((asset) => asset.type === options.type)
	if (options.ids.length > 0) {
		const wanted = new Set(options.ids)
		assets = assets.filter((asset) => wanted.has(asset.id))
		const found = new Set(assets.map((asset) => asset.id))
		const missing = options.ids.filter((id) => !found.has(id))
		if (missing.length > 0) throw new Error('Unknown asset id: ' + missing.join(', '))
	}

	const queue = assets.flatMap((asset) => jobs(asset, options.variant))
	if (options.list) {
		for (const job of queue) {
			console.log(job.asset.id + '\t' + job.asset.type + '\t' + job.asset.name + '\tpublic' + outputPath(job))
		}
		return
	}
	if (queue.length === 0) {
		console.log(
			'Usage: bun run asset:prompt -- [--list] [--type spell|character|scene] ' +
				'[--variant landscape|portrait] [asset-id...]',
		)
		return
	}
	console.log(queue.map((job) => compose(job)).join('\n\n---\n\n'))
}

if (import.meta.main) runPromptCli(Bun.argv.slice(2))
