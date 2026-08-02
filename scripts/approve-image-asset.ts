import {randomUUID} from 'node:crypto'
import {access, link, mkdir, rename, unlink, writeFile} from 'node:fs/promises'
import {join, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import sharp from 'sharp'
import {expectedSize, findAsset, outputPath, singleJob, variantNames, type VariantName} from './asset-prompts'
import {errorMessage, validatePng} from './image-asset-files'

const maxDeliveryBytes = 1024 * 1024
const paletteQualities = [90, 80, 70, 60, 50, 40, 30, 20, 10]

type Options = {
	candidate: string
	assetId: string
	variant?: VariantName
	replace: boolean
}

function parseArgs(args: string[]): Options {
	const positional: string[] = []
	let variant: string | undefined
	let replace = false

	for (let index = 0; index < args.length; index++) {
		const arg = args[index]
		if (arg === '--variant') {
			variant = args[index + 1]
			if (variant === undefined) throw new Error('--variant requires landscape or portrait')
			index++
			continue
		}
		if (arg === '--replace') {
			replace = true
			continue
		}
		if (arg.startsWith('--')) throw new Error('Unknown option: ' + arg)
		positional.push(arg)
	}

	if (positional.length !== 2) {
		throw new Error(
			'Usage: bun run asset:approve -- CANDIDATE_PATH ASSET_ID [--variant landscape|portrait] [--replace]',
		)
	}
	if (variant !== undefined && !variantNames.includes(variant as VariantName)) {
		throw new Error('--variant requires landscape or portrait')
	}
	return {
		candidate: resolve(positional[0]),
		assetId: positional[1],
		variant: variant as VariantName | undefined,
		replace,
	}
}

async function exists(path: string): Promise<boolean> {
	try {
		await access(path)
		return true
	} catch {
		return false
	}
}

async function makeDeliveryPng(source: string): Promise<{buffer: Buffer; quality: number}> {
	let lastSize = 0
	for (const quality of paletteQualities) {
		const buffer = await sharp(source).png({compressionLevel: 9, palette: true, quality, effort: 10}).toBuffer()
		lastSize = buffer.byteLength
		if (buffer.byteLength <= maxDeliveryBytes) return {buffer, quality}
	}
	throw new Error(
		'Palette optimization could not bring the delivery copy under 1 MiB (smallest was ' + lastSize + ' bytes)',
	)
}

async function installAtomically(destination: string, buffer: Buffer, replace: boolean): Promise<void> {
	await mkdir(join(destination, '..'), {recursive: true})
	if (!replace && (await exists(destination))) {
		throw new Error('Approved asset already exists: ' + destination + ' (pass --replace to overwrite it)')
	}

	const temporary = destination + '.tmp-' + randomUUID()
	await writeFile(temporary, buffer, {flag: 'wx'})
	try {
		if (replace) await rename(temporary, destination)
		else await link(temporary, destination)
	} catch (error) {
		if (!replace && (await exists(destination))) {
			throw new Error('Approved asset already exists: ' + destination + ' (pass --replace to overwrite it)')
		}
		throw error
	} finally {
		if (await exists(temporary)) await unlink(temporary)
	}
}

export async function approveImageAsset(args: string[]): Promise<void> {
	const options = parseArgs(args)
	const job = singleJob(findAsset(options.assetId), options.variant)
	const expected = expectedSize(job)
	await validatePng(options.candidate, expected)

	const {buffer, quality} = await makeDeliveryPng(options.candidate)
	const projectRoot = fileURLToPath(new URL('..', import.meta.url))
	const destination = join(projectRoot, 'public', outputPath(job).slice(1))
	await installAtomically(destination, buffer, options.replace)

	console.log('Approved source: ' + options.candidate)
	console.log('Delivery copy: ' + destination)
	console.log('Palette PNG: quality ' + quality + ', ' + buffer.byteLength + ' bytes')
}

if (import.meta.main) {
	approveImageAsset(Bun.argv.slice(2)).catch((error) => {
		console.error('asset:approve: ' + errorMessage(error))
		process.exitCode = 1
	})
}
