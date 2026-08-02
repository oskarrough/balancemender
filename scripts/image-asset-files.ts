import sharp, {type Metadata} from 'sharp'

export type ImageSize = {width: number; height: number}

export function assertPngMetadata(metadata: Pick<Metadata, 'format' | 'width' | 'height'>, expected: ImageSize): void {
	if (metadata.format !== 'png') {
		throw new Error('Expected a PNG, got ' + (metadata.format ?? 'an unknown image type'))
	}
	if (metadata.width !== expected.width || metadata.height !== expected.height) {
		throw new Error(
			'Expected ' +
				expected.width +
				'x' +
				expected.height +
				', got ' +
				(metadata.width ?? '?') +
				'x' +
				(metadata.height ?? '?'),
		)
	}
}

export async function validatePng(path: string, expected: ImageSize): Promise<void> {
	let metadata: Metadata
	try {
		metadata = await sharp(path).metadata()
	} catch (error) {
		throw new Error('Could not decode image: ' + errorMessage(error))
	}
	assertPngMetadata(metadata, expected)
}

export function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}
