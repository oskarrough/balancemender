import {describe, expect, it} from 'vitest'
import {compose, expectedSize, findAsset, jobs, manifest, outputPath, singleJob, type Job} from './asset-prompts'
import {assertPngMetadata} from './image-asset-files'

describe('image asset jobs', () => {
	it('keeps both views when one scene is requested without a variant', () => {
		const queue = jobs(findAsset('green-first-blood'))
		expect(queue.map(outputPath)).toEqual([
			'/assets/generated/explorations/green-first-blood.png',
			'/assets/generated/explorations/green-first-blood-portrait.png',
		])
	})

	it('requires one scene variant for a single production job', () => {
		expect(() => singleJob(findAsset('green-first-blood'))).toThrow('requires --variant')
		expect(outputPath(singleJob(findAsset('green-first-blood'), 'portrait'))).toBe(
			'/assets/generated/explorations/green-first-blood-portrait.png',
		)
		expect(() => singleJob(findAsset('renew'), 'portrait')).toThrow('only valid for scene')
	})

	it('composes a candidate target without exposing an approved path', () => {
		const prompt = compose(singleJob(findAsset('renew')), 'candidate.png')
		expect(prompt).toContain('Output target: candidate.png')
		expect(prompt).toContain('square image at 1024x1024')
		expect(prompt).not.toContain('public/assets/generated')
	})
})

describe('image asset validation', () => {
	it('requires exact 1024x1024 spell and character images', () => {
		expect(expectedSize(singleJob(findAsset('renew')))).toEqual({width: 1024, height: 1024})
		expect(expectedSize(singleJob(findAsset('runt')))).toEqual({width: 1024, height: 1024})
	})

	it('derives scene dimensions from SceneVariant.size', () => {
		const job: Job = {
			asset: findAsset('green-first-blood'),
			variant: {...manifest.sceneVariants.landscape, size: '321x654'},
		}
		expect(expectedSize(job)).toEqual({width: 321, height: 654})
	})

	it('rejects the wrong type or dimensions', () => {
		expect(() =>
			assertPngMetadata({format: 'png', width: 1024, height: 1024}, {width: 1024, height: 1024}),
		).not.toThrow()
		expect(() => assertPngMetadata({format: 'jpeg', width: 1024, height: 1024}, {width: 1024, height: 1024})).toThrow(
			'Expected a PNG',
		)
		expect(() => assertPngMetadata({format: 'png', width: 512, height: 1024}, {width: 1024, height: 1024})).toThrow(
			'Expected 1024x1024, got 512x1024',
		)
	})
})
