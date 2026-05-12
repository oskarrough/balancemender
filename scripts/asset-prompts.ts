type AssetType = 'spell' | 'character'

type Asset = {
	id: string
	type: AssetType
	name: string
	prompt: string
}

type Manifest = {
	project: string
	style: string
	types: Record<AssetType, string>
	assets: Asset[]
}

const manifest = (await Bun.file(new URL('../assets/image-assets.json', import.meta.url)).json()) as Manifest
const args = Bun.argv.slice(2)
const ids: string[] = []
let list = false
let type: string | undefined

for (let index = 0; index < args.length; index++) {
	const arg = args[index]
	if (arg === '--list') {
		list = true
		continue
	}
	if (arg === '--type') {
		type = args[index + 1]
		if (type === undefined) throw new Error('--type must be spell or character')
		index++
		continue
	}
	ids.push(arg)
}

if (type !== undefined && type !== 'spell' && type !== 'character') {
	throw new Error('--type must be spell or character')
}

function outputPath(asset: Asset) {
	return '/assets/generated/' + asset.type + 's/' + asset.id + '.png'
}

function compose(asset: Asset) {
	return [
		'Create one production game asset for ' + manifest.project + '.',
		'',
		'Asset name: ' + asset.name,
		'Asset type: ' + asset.type,
		'Output target after approval: public' + outputPath(asset),
		'',
		'Stylistic prompt: ' + manifest.style,
		'Type prompt: ' + manifest.types[asset.type],
		'Individual prompt: ' + asset.prompt,
		'',
		'Render requirements: square image, no text, no watermark, no border. Use gpt-image-2/Codex image generation. After generating, save the selected image to the output target path in the repo.',
	].join('\n')
}

let assets = manifest.assets

if (type) assets = assets.filter((asset) => asset.type === type)
if (ids.length > 0) {
	const wanted = new Set(ids)
	assets = assets.filter((asset) => wanted.has(asset.id))
	const found = new Set(assets.map((asset) => asset.id))
	const missing = ids.filter((id) => !found.has(id))
	if (missing.length > 0) throw new Error('Unknown asset id: ' + missing.join(', '))
}

if (list) {
	for (const asset of assets)
		console.log(asset.id + '\t' + asset.type + '\t' + asset.name + '\tpublic' + outputPath(asset))
	process.exit(0)
}

if (assets.length === 0) {
	console.log('Usage: bun run asset:prompt -- [--list] [--type spell|character] [asset-id...]')
	process.exit(0)
}

console.log(assets.map(compose).join('\n\n---\n\n'))
