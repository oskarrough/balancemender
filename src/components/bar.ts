import {Spell} from '../nodes/spell'
import {html, toPercent} from '../utils'

interface BarProps {
	value: number
	max: number
	type: string
}

export function Bar({value, max, type}: BarProps) {
	const percent = toPercent(value, max)
	const barStyles = `width: ${percent}%`
	return html` <div class="Bar" data-type=${type}>
		<div style=${barStyles}></div>
		<span>${Math.round(value)}/${max} ${type}</span>
	</div>`
}

/**
 * Used for "bars" that indicate a min/max like health and mana.
 * <meter min="0" max=${max} value=${current}></meter>
 */
interface MeterProps extends BarProps {
	potentialValue?: number
	spell?: Spell
}

export function Meter({value, max, type, potentialValue = 0, spell}: MeterProps) {
	if (!value) value = 0
	if (!max) max = 0

	const percent = toPercent(value, max)
	const barStyles = `width: ${percent}%`

	if (spell?.delay === 0) {
		potentialValue = potentialValue - (potentialValue / spell.repeat) * spell.cycles
	}
	const potentialBarStyles = `left: ${percent}%; width: ${toPercent(
		potentialValue,
		max,
	)}%`

	return html` <div class="Bar" data-type=${type}>
		<div style="${barStyles}"></div>
		<div class="Bar-potentialValue" style=${potentialBarStyles}></div>
		<span>${Math.round(value)}/${max}</span>
	</div>`
}
