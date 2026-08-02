import {randomUUID} from 'node:crypto'
import {spawn} from 'node:child_process'
import {access, copyFile, mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {basename, extname, join, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {compose, expectedSize, findAsset, outputPath, singleJob, variantNames, type VariantName} from './asset-prompts'
import {errorMessage, validatePng} from './image-asset-files'

const defaultModel = 'gpt-5.6-sol'
const defaultEffort = 'low'
const maxCandidates = 4
const effortNames = ['minimal', 'low', 'medium', 'high', 'xhigh'] as const
const referenceRoles = ['style', 'identity'] as const
type ReferenceRole = (typeof referenceRoles)[number]

type Options = {
	assetId: string
	variant?: VariantName
	candidates: number
	references: string[]
	referenceRole: ReferenceRole
	model: string
	effort: string
}

type ProcessResult = {
	exitCode: number | null
	signal: NodeJS.Signals | null
	stdout: Buffer
	stderr: Buffer
	timedOut: boolean
}

type CandidateResult = {ok: boolean; path?: string; error?: string}

function optionValue(args: string[], index: number, option: string): string {
	const value = args[index + 1]
	if (value === undefined || value.startsWith('--')) throw new Error(option + ' requires a value')
	return value
}

function parseArgs(args: string[]): Options {
	const positional: string[] = []
	const references: string[] = []
	let variant: string | undefined
	let candidates = 1
	let referenceRole: ReferenceRole = 'style'
	let model = defaultModel
	let effort = defaultEffort

	for (let index = 0; index < args.length; index++) {
		const arg = args[index]
		if (arg === '--variant') {
			variant = optionValue(args, index, arg)
			index++
			continue
		}
		if (arg === '--candidates') {
			const value = optionValue(args, index, arg)
			candidates = Number(value)
			if (!Number.isInteger(candidates) || candidates < 1 || candidates > maxCandidates) {
				throw new Error('--candidates must be an integer from 1 to ' + maxCandidates)
			}
			index++
			continue
		}
		if (arg === '--reference') {
			references.push(resolve(optionValue(args, index, arg)))
			index++
			continue
		}
		if (arg === '--reference-role') {
			const value = optionValue(args, index, arg)
			if (!referenceRoles.includes(value as ReferenceRole)) {
				throw new Error('--reference-role must be ' + referenceRoles.join(' or '))
			}
			referenceRole = value as ReferenceRole
			index++
			continue
		}
		if (arg === '--model') {
			model = optionValue(args, index, arg)
			index++
			continue
		}
		if (arg === '--effort') {
			effort = optionValue(args, index, arg)
			index++
			continue
		}
		if (arg.startsWith('--')) throw new Error('Unknown option: ' + arg)
		positional.push(arg)
	}

	if (positional.length !== 1) {
		throw new Error(
			'Usage: bun run asset:generate -- ASSET_ID [--variant landscape|portrait] [--candidates 1-4] ' +
				'[--reference PATH ...] [--reference-role style|identity] [--model MODEL] ' +
				'[--effort minimal|low|medium|high|xhigh]',
		)
	}
	if (variant !== undefined && !variantNames.includes(variant as VariantName)) {
		throw new Error('--variant requires landscape or portrait')
	}
	if (!effortNames.includes(effort as (typeof effortNames)[number])) {
		throw new Error('--effort must be ' + effortNames.join(', '))
	}
	return {
		assetId: positional[0],
		variant: variant as VariantName | undefined,
		candidates,
		references,
		referenceRole,
		model,
		effort,
	}
}

async function runCodex(args: string[], cwd: string, prompt: string): Promise<ProcessResult> {
	return await new Promise((resolvePromise, reject) => {
		const child = spawn('codex', args, {cwd, stdio: ['pipe', 'pipe', 'pipe']})
		const stdout: Buffer[] = []
		const stderr: Buffer[] = []
		let timedOut = false
		let forceKill: ReturnType<typeof setTimeout> | undefined
		const timeout = setTimeout(
			() => {
				timedOut = true
				child.kill('SIGTERM')
				forceKill = setTimeout(() => child.kill('SIGKILL'), 5000)
			},
			5 * 60 * 1000,
		)
		child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk))
		child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk))
		child.stdin.on('error', () => undefined)
		child.once('error', (error) => {
			clearTimeout(timeout)
			if (forceKill) clearTimeout(forceKill)
			reject(error)
		})
		child.once('close', (exitCode, signal) => {
			clearTimeout(timeout)
			if (forceKill) clearTimeout(forceKill)
			resolvePromise({
				exitCode,
				signal,
				stdout: Buffer.concat(stdout),
				stderr: Buffer.concat(stderr),
				timedOut,
			})
		})
		child.stdin.end(prompt)
	})
}

function runName(options: Options): string {
	const timestamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
	return [timestamp, options.assetId, options.variant, randomUUID().slice(0, 8)].filter(Boolean).join('-')
}

async function generateCandidate(
	index: number,
	runDirectory: string,
	options: Options,
	prompt: string,
	expected: {width: number; height: number},
): Promise<CandidateResult> {
	const number = index + 1
	const prefix = 'candidate-' + number
	const candidatePath = join(runDirectory, prefix + '.png')
	const promptPath = join(runDirectory, prefix + '.prompt.txt')
	const jsonlPath = join(runDirectory, prefix + '.codex.jsonl')
	const stderrPath = join(runDirectory, prefix + '.stderr.log')
	const metadataPath = join(runDirectory, prefix + '.metadata.json')
	const startedAt = new Date()
	let temporaryDirectory: string | undefined
	let processResult: ProcessResult | undefined
	let validationError: string | undefined
	let status = 'failed'

	await writeFile(promptPath, prompt)
	try {
		temporaryDirectory = await mkdtemp(join(tmpdir(), 'balancemender-image-'))
		const stagedPath = join(temporaryDirectory, 'candidate.png')
		const referencePaths: string[] = []
		for (const [referenceIndex, source] of options.references.entries()) {
			const extension = extname(source)
			const destination = join(
				temporaryDirectory,
				'reference-' + (referenceIndex + 1) + (extension || '-' + basename(source)),
			)
			await copyFile(source, destination)
			referencePaths.push(destination)
		}

		const codexArgs = [
			'exec',
			'--model',
			options.model,
			'-c',
			'model_reasoning_effort="' + options.effort + '"',
			'--ignore-user-config',
			'--ephemeral',
			'--sandbox',
			'workspace-write',
			'--skip-git-repo-check',
			'--enable',
			'image_generation',
			'--json',
			'-C',
			temporaryDirectory,
		]
		for (const reference of referencePaths) codexArgs.push('--image', reference)
		codexArgs.push('-')

		processResult = await runCodex(codexArgs, temporaryDirectory, prompt)
		await Promise.all([writeFile(jsonlPath, processResult.stdout), writeFile(stderrPath, processResult.stderr)])

		try {
			await validatePng(stagedPath, expected)
			await copyFile(stagedPath, candidatePath)
			status = processResult.exitCode === 0 ? 'generated' : 'recovered-after-codex-error'
		} catch (error) {
			validationError = errorMessage(error)
		}
	} catch (error) {
		validationError = errorMessage(error)
		if (!processResult) {
			await Promise.all([writeFile(jsonlPath, ''), writeFile(stderrPath, validationError + '\n')])
		}
	} finally {
		if (temporaryDirectory) await rm(temporaryDirectory, {recursive: true, force: true})
	}

	const finishedAt = new Date()
	const exitDescription = processResult
		? processResult.timedOut
			? 'timed out after 5 minutes'
			: processResult.exitCode === null
				? 'signal ' + (processResult.signal ?? 'unknown')
				: 'code ' + processResult.exitCode
		: 'not started'
	const metadata = {
		assetId: options.assetId,
		variant: options.variant ?? null,
		candidate: number,
		status,
		startedAt: startedAt.toISOString(),
		finishedAt: finishedAt.toISOString(),
		durationMs: finishedAt.getTime() - startedAt.getTime(),
		model: options.model,
		effort: options.effort,
		references: options.references,
		referenceRole: options.referenceRole,
		expected,
		codexExitCode: processResult?.exitCode ?? null,
		codexSignal: processResult?.signal ?? null,
		codexTimedOut: processResult?.timedOut ?? false,
		output: status === 'failed' ? null : candidatePath,
		error: validationError ?? null,
	}
	await writeFile(metadataPath, JSON.stringify(metadata, null, 2) + '\n')

	if (status === 'generated') return {ok: true, path: candidatePath}
	if (status === 'recovered-after-codex-error') {
		return {
			ok: false,
			path: candidatePath,
			error:
				'Candidate ' +
				number +
				': Codex exited with ' +
				exitDescription +
				' after producing a valid image; recovered it and marked the metadata ' +
				status,
		}
	}
	return {
		ok: false,
		error:
			'Candidate ' +
			number +
			' failed (Codex ' +
			exitDescription +
			'): ' +
			(validationError ?? 'no valid image was produced') +
			'. See ' +
			metadataPath,
	}
}

export async function generateImageAsset(args: string[]): Promise<void> {
	const options = parseArgs(args)
	const asset = findAsset(options.assetId)
	const job = singleJob(asset, options.variant)
	const projectRoot = fileURLToPath(new URL('..', import.meta.url))

	if (asset.type === 'scene' && options.variant === 'portrait' && options.references.length === 0) {
		const landscape = singleJob(asset, 'landscape')
		const approvedLandscape = join(projectRoot, 'public', outputPath(landscape).slice(1))
		try {
			await access(approvedLandscape)
			options.references.push(approvedLandscape)
			options.referenceRole = 'identity'
		} catch {
			throw new Error(
				'Portrait scenes need their approved landscape as a reference. Approve the landscape first or pass --reference PATH.',
			)
		}
	}
	for (const reference of options.references) {
		try {
			await access(reference)
		} catch {
			throw new Error('Reference does not exist: ' + reference)
		}
	}

	const runDirectory = join(projectRoot, 'tmp', 'image-assets', runName(options))
	await mkdir(runDirectory, {recursive: true})
	const referenceInstruction =
		options.references.length === 0
			? ''
			: options.referenceRole === 'identity'
				? '\n\nInput images: Treat the attached image' +
					(options.references.length === 1 ? '' : 's') +
					' as identity and continuity reference' +
					(options.references.length === 1 ? '' : 's') +
					'. Preserve landmarks, subject identity, anatomy, palette, materials, light, and art style. Recompose for this brief; do not merely crop or copy the reference composition.'
				: '\n\nInput images: Treat the attached image' +
					(options.references.length === 1 ? '' : 's') +
					' as art-style reference' +
					(options.references.length === 1 ? '' : 's') +
					' only. Match their medium, shape language, line treatment, texture, and level of detail. The written brief remains authoritative for subject, palette, and composition.'
	const prompt = compose(job, 'candidate.png') + referenceInstruction
	const expected = expectedSize(job)
	console.log('Generating ' + options.candidates + ' candidate(s) in ' + runDirectory)

	const results = await Promise.all(
		Array.from({length: options.candidates}, (_, index) =>
			generateCandidate(index, runDirectory, options, prompt, expected),
		),
	)
	for (const result of results) {
		if (result.path) console.log('Candidate: ' + result.path)
		if (result.error) console.error(result.error)
	}
	const failures = results.filter((result) => !result.ok).length
	if (failures > 0) {
		throw new Error(
			failures + ' of ' + results.length + ' candidate generation process(es) failed; logs kept in ' + runDirectory,
		)
	}
}

if (import.meta.main) {
	generateImageAsset(Bun.argv.slice(2)).catch((error) => {
		console.error('asset:generate: ' + errorMessage(error))
		process.exitCode = 1
	})
}
