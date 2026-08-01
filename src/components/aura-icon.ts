import {html} from 'uhtml'
import type {Aura} from '../nodes/aura'
import {PeriodicAura} from '../nodes/periodic-aura'
import {spellIconPath} from './icon-path'

/**
 * Where an aura is in its life. `elapsedTime` is the aura's own clock, and cycle `n` fires at
 * `delay + interval * n`, so the last tick — and the removal with it — lands at
 * `delay + interval * (repeat - 1)`. A `BarrierAura` has `repeat = 1`, which collapses that to its
 * lifetime, and the same two numbers read as a plain countdown.
 */
function timing(aura: Aura) {
	const {delay, interval, repeat, _cycles, elapsedTime} = aura
	const totalMs = delay + interval * (repeat - 1)
	const nextTickAt = delay + interval * _cycles
	// The first gap is `delay`, every later one is `interval`; they differ on an aura that ticks
	// immediately, and a bar that assumed otherwise would start part-full.
	const span = _cycles === 0 ? delay : interval
	const clamp = (n: number) => Math.min(1, Math.max(0, n))
	return {
		remaining: Math.max(0, totalMs - elapsedTime) / 1000,
		left: totalMs > 0 ? clamp(1 - elapsedTime / totalMs) : 0,
		toNextTick: span > 0 ? clamp(1 - (nextTickAt - elapsedTime) / span) : 1,
	}
}

/**
 * An aura on a unit frame: a square of the spell's own art, the size of an action bar icon shrunk
 * to a fifth, so the Renew you cast and the Renew sitting on the tank are recognisably one thing.
 * Art first, because at five frames on screen a row of pictures is scannable and a row of words is
 * not — the name stays in the tooltip.
 *
 * What the chrome says, in the order the eye gets there: a red or green rim for who the aura is
 * good for, the bottom strip for how much is left, and the seconds for when precision matters. The
 * strip is pips when the aura ticks — one per instalment, the next one filling as its interval runs
 * down — and a plain draining bar when it does not.
 *
 * @param stacks how many copies are on the target; drawn as a corner count past one.
 */
export function AuraIcon(aura: Aura, stacks = 1) {
	const {remaining, left, toNextTick} = timing(aura)
	const harmful = aura instanceof PeriodicAura && aura.harms
	const pips = Array.from({length: aura.repeat}, (_, i) => i)

	return html`
		<li
			class=${`Plate AuraIcon ${harmful ? 'AuraIcon--harmful' : 'AuraIcon--helpful'} ${remaining <= 3 ? 'AuraIcon--expiring' : ''}`}
			style=${`--left: ${left * 100}%; --tick: ${toNextTick * 100}%`}
			title=${`${aura.name} — ${aura._cycles}/${aura.repeat} ticks, ${remaining.toFixed(1)}s left`}
		>
			<img class="Plate-image AuraIcon-art" src=${spellIconPath(aura.id)} alt="" />
			<div class="Plate-inner AuraIcon-inner">
				${stacks > 1 ? html`<b class="AuraIcon-stacks">${stacks}</b>` : null}
				<strong>${remaining < 10 ? remaining.toFixed(1) : Math.ceil(remaining)}</strong>
			</div>
			${aura.repeat > 1
				? html`<ol class="AuraIcon-pips">
						${pips.map(
							(i) =>
								html`<li
									class=${i < aura._cycles ? 'is-done' : ''}
									style=${i === aura._cycles ? `--tick: ${toNextTick * 100}%` : ''}
								></li>`,
						)}
					</ol>`
				: html`<div class="AuraIcon-life"></div>`}
		</li>
	`
}
