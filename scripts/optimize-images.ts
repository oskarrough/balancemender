import {readdir, stat} from 'node:fs/promises'
import {join, relative} from 'node:path'
import sharp from 'sharp'

const root = new URL('../public/assets/generated/', import.meta.url).pathname
const args = Bun.argv.slice(2)
const ids: string[] = []
let max = 1440
let dryRun = false

for (let index = 0; index < args.length; index++) {
	const arg = args[index]
	if (arg === '--max') {
		const value = args[index + 1]
		if (value === undefined) throw new Error('--max requires a pixel value')
		max = Number.parseInt(value, 10)
		if (!Number.isFinite(max) || max <= 0) throw new Error('--max must be a positive integer')
		index++
		continue
	}
	if (arg === '--dry-run') {
		dryRun = true
		continue
	}
	ids.push(arg)
}

const wanted = ids.length > 0 ? new Set(ids) : null

async function* walk(dir: string): AsyncGenerator<string> {
	for (const entry of await readdir(dir, {withFileTypes: true})) {
		const full = join(dir, entry.name)
		if (entry.isDirectory()) yield* walk(full)
		else if (entry.isFile() && entry.name.endsWith('.png')) yield full
	}
}

function format(bytes: number) {
	if (bytes < 1024) return bytes + ' B'
	if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
	return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

let totalBefore = 0
let totalAfter = 0
let processed = 0

for await (const file of walk(root)) {
	const id = file.slice(0, -4).split('/').pop() as string
	if (wanted && !wanted.has(id)) continue

	const before = (await stat(file)).size
	const image = sharp(file)
	const meta = await image.metadata()
	const longest = Math.max(meta.width ?? 0, meta.height ?? 0)

	const resized =
		longest > max
			? image.resize({width: max, height: max, fit: 'inside', withoutEnlargement: true})
			: image

	const buffer = await resized
		.png({compressionLevel: 9, palette: true, quality: 80, effort: 10})
		.toBuffer()

	if (!dryRun) await Bun.write(file, buffer)
	const after = buffer.byteLength
	totalBefore += before
	totalAfter += after
	processed++

	const change = before > 0 ? Math.round(((before - after) / before) * 100) : 0
	console.log(
		(dryRun ? '[dry] ' : '') +
			relative(root, file) +
			'\t' +
			(meta.width ?? '?') +
			'x' +
			(meta.height ?? '?') +
			' -> max ' +
			max +
			'\t' +
			format(before) +
			' -> ' +
			format(after) +
			' (-' +
			change +
			'%)',
	)
}

if (processed === 0) {
	console.log('No matching PNGs found under public/assets/generated/.')
	process.exit(0)
}

const totalChange = totalBefore > 0 ? Math.round(((totalBefore - totalAfter) / totalBefore) * 100) : 0
console.log(
	'\nTotal: ' + format(totalBefore) + ' -> ' + format(totalAfter) + ' (-' + totalChange + '%) across ' + processed + ' file' + (processed === 1 ? '' : 's'),
)
