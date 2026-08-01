import {html} from 'uhtml'
import type {Aura} from '../nodes/aura'
import {PeriodicAura} from '../nodes/periodic-aura'
import {BarrierAura} from '../nodes/barrier-aura'
import {StatModifierAura} from '../nodes/stat-modifier-aura'
import {roundOne} from '../utils'
import {registerTip} from './tooltip'
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
			data-tip=${`aura:${aura.parent.id}:${aura.stackKey}`}
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

/** What kind of thing this is, under the name. */
function kindOf(aura: Aura) {
	if (aura instanceof PeriodicAura) return `${aura.school} · ${aura.harms ? 'damage over time' : 'heal over time'}`
	if (aura instanceof BarrierAura) return 'barrier'
	if (aura instanceof StatModifierAura) return 'stat modifier'
	return 'aura'
}

/** What it is doing to the unit, in the numbers it is doing it with right now. */
function effectOf(aura: Aura) {
	if (aura instanceof PeriodicAura) {
		const instalment = Math.round(aura.total / aura.repeat)
		const verb = aura.harms ? 'Deals' : 'Heals'
		return html`<p class="Tooltip-effect">
			${verb} ${instalment} every ${roundOne(aura.interval / 1000)}s — ${Math.round(aura.total)} in all.
		</p>`
	}
	if (aura instanceof BarrierAura)
		return html`<p class="Tooltip-effect">Absorbs the next ${Math.round(aura.pool)} damage.</p>`
	if (aura instanceof StatModifierAura)
		return html`<p class="Tooltip-effect">${aura.modifier > 0 ? '+' : ''}${Math.round(aura.modifier)} ${aura.stat}.</p>`
	return null
}

/** The same aura the chip draws, in full. Redrawn every frame, so the countdown is the live one. */
registerTip('aura', (rest, game) => {
	const split = rest.indexOf(':')
	const unit = game?.fight?.units.find((candidate) => candidate.id === rest.slice(0, split))
	const stacked = [...(unit?.auras ?? [])].filter((aura) => aura.stackKey === rest.slice(split + 1))
	// The chip draws the last copy — it has the longest left to run — so the tooltip reads it too.
	const aura = stacked.at(-1)
	if (!aura) return null

	const {remaining} = timing(aura)
	const harmful = aura instanceof PeriodicAura && aura.harms
	const ticks = aura.repeat > 1 ? html`<span>${aura._cycles} of ${aura.repeat} ticks</span>` : null

	return html`
		<article class=${`Tooltip-body ${harmful ? 'Tooltip-body--harmful' : 'Tooltip-body--helpful'}`}>
			<h3>${aura.name}</h3>
			<p class="Tooltip-kind">${kindOf(aura)}${stacked.length > 1 ? html` · ${stacked.length} stacks` : null}</p>
			${effectOf(aura)}
			<p class="Tooltip-timing">${ticks}<span>${remaining.toFixed(1)}s left</span></p>
			<footer>Cast by ${aura.casterName}</footer>
		</article>
	`
})
