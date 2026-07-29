import {html} from 'uhtml'
import type {Aura} from '../nodes/aura'
import {PeriodicAura} from '../nodes/periodic-aura'

/**
 * Where an aura is in its life. `elapsedTime` is the aura's own clock, and cycle `n` fires at
 * `delay + interval * n`, so the last tick — and the removal with it — lands at
 * `delay + interval * (repeat - 1)`. A `ShieldAura` has `repeat = 1`, which collapses that to its
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
 * An aura on a unit frame. Same shape as an action bar icon, a quarter the size, so a Rend here
 * and a Rend in the spellbook read as one thing. What it says, in the order the eye gets there:
 * green or red for who it is good for, a draining bar for how long it has, pips for how many
 * instalments are left, and the seconds for when precision matters.
 *
 * No radial sweep: the game says "how much is left" with bars everywhere else, and a wedge over
 * a 4rem icon is a shape, not a clock.
 */
export function AuraIcon(aura: Aura) {
	const {remaining, left, toNextTick} = timing(aura)
	const harmful = aura instanceof PeriodicAura && aura.total < 0
	const pips = Array.from({length: aura.repeat}, (_, i) => i)

	return html`
		<li
			class=${`Ability Aura ${harmful ? 'Aura--harmful' : 'Aura--helpful'} ${remaining <= 3 ? 'Aura--expiring' : ''}`}
			style=${`--left: ${left * 100}%; --tick: ${toNextTick * 100}%`}
			title=${`${aura.name} — ${aura._cycles}/${aura.repeat} ticks, ${remaining.toFixed(1)}s left`}
		>
			<div class="Ability-inner Aura-inner">
				<h3>${aura.name}</h3>
				<strong>${remaining < 10 ? remaining.toFixed(1) : Math.ceil(remaining)}s</strong>
			</div>
			${aura.repeat > 1
				? html`<ol class="Aura-pips">
						${pips.map(
							(i) =>
								html`<li
									class=${i < aura._cycles ? 'is-done' : ''}
									style=${i === aura._cycles ? `--tick: ${toNextTick * 100}%` : ''}
								></li>`,
						)}
					</ol>`
				: null}
			<div class="Aura-life"></div>
		</li>
	`
}
