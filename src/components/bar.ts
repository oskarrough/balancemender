import type {Ability} from '../nodes/ability'
import {html} from 'uhtml'
import {toPercent} from '../utils'

interface MeterProps {
	value: number
	max: number
	type: string
	/** How much of the bar the player's cast in flight would add, drawn ahead of the filled part. */
	potentialValue?: number
	/** Damage the target's barriers can still swallow, drawn past the fill as extra effective health. */
	absorbValue?: number
	ability?: Ability
	/** The last stretch of a cast bar a sweet-spot tap must land in, in ms (#33). */
	sweetSpotWindow?: number
	/** Mana per second, and whether the five-second rule is currently letting it through. */
	regen?: {rate: number; active: boolean}
}

export function Meter({
	value,
	max,
	type,
	potentialValue = 0,
	absorbValue = 0,
	ability,
	sweetSpotWindow,
	regen,
}: MeterProps) {
	if (!value) value = 0
	if (!max) max = 0

	const percent = toPercent(value, max)

	/**
	 * Absorption reads as health you have not lost yet, so it extends the fill rather than sitting
	 * inside it. A pool larger than the missing health has nowhere left to draw — it is clamped to
	 * the end of the bar and the edge is capped, because a bar silently drawing less than the pool
	 * would understate how much the unit can take.
	 */
	const absorbWanted = toPercent(absorbValue, max)
	const absorbPercent = Math.min(absorbWanted, 100 - percent)
	const absorbCapped = absorbWanted > 100 - percent

	// An instant ability with instalments left has already landed some of what it promised.
	if (ability?.delay === 0) {
		potentialValue = potentialValue - (potentialValue / ability.repeat) * ability._cycles
	}

	/* One tick of regen is one second of it, so the rate is also the size of the next instalment —
	   the same overlay a heal in the air uses, saying the same thing about mana. */
	if (regen?.active) potentialValue = regen.rate

	const label = type === 'cast' ? `${(value / 1000).toFixed(1)}s` : `${Math.round(value)}/${max}`

	return html` <div class="Bar" data-type=${type}>
		<div class="Bar-value" style=${`width: ${percent}%`}></div>
		${absorbPercent > 0
			? html`<div
					class=${`Bar-absorb ${absorbCapped ? 'Bar-absorb--capped' : ''}`}
					style=${`left: ${percent}%; width: ${absorbPercent}%`}
				></div>`
			: null}
		<div
			class="Bar-potentialValue"
			style=${`left: ${percent + absorbPercent}%; width: ${Math.min(toPercent(potentialValue, max), 100 - percent - absorbPercent)}%`}
		></div>
		${sweetSpotWindow
			? html`<div class="Bar-sweetSpot" style=${`width: ${toPercent(sweetSpotWindow, max)}%`}></div>`
			: null}
		<span>${label}${regen ? html`<i class="Bar-regen" data-active=${regen.active}>+${regen.rate}</i>` : null}</span>
	</div>`
}
