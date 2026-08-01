import {unitRegistry, UnitId} from '../nodes/unit-registry'

/**
 * `'Runt*3, Haruk'` → `['Runt', 'Runt', 'Runt', 'Haruk']`
 *
 * Validates against the unit registry here, at the edge, so a typo on the command line
 * is a usage error rather than a throw from deep inside a fight.
 */
export function parseUnits(input: string): UnitId[] {
	const out: UnitId[] = []
	for (const part of input.split(',')) {
		const [name, count = '1'] = part.trim().split('*')
		const id = name?.trim()
		if (!id) continue
		if (!(id in unitRegistry)) {
			throw new Error(`Unknown unit: "${id}". Known: ${Object.keys(unitRegistry).join(', ')}`)
		}
		for (let i = 0; i < Number(count); i++) out.push(id as UnitId)
	}
	return out
}
