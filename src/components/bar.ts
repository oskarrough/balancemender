import type {Ability} from '../nodes/ability'
import {html} from 'uhtml'
import {toPercent} from '../utils'

interface MeterProps {
	value: number
	max: number
	type: string
	/** How much of the bar the player's cast in flight would add, drawn ahead of the filled part. */
	potentialValue?: number
	ability?: Ability
}

export function Meter({value, max, type, potentialValue = 0, ability}: MeterProps) {
	if (!value) value = 0
	if (!max) max = 0

	const percent = toPercent(value, max)

	// An instant ability with instalments left has already landed some of what it promised.
	if (ability?.delay === 0) {
		potentialValue = potentialValue - (potentialValue / ability.repeat) * ability._cycles
	}

	return html` <div class="Bar" data-type=${type}>
		<div class="Bar-value" style=${`width: ${percent}%`}></div>
		<div class="Bar-potentialValue" style=${`left: ${percent}%; width: ${toPercent(potentialValue, max)}%`}></div>
		<span>${Math.round(value)}/${max}</span>
	</div>`
}
