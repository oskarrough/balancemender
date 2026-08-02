import {html} from 'uhtml'
import type {GameLoop} from '../nodes/game-loop'
import type {AbilityClass} from '../nodes/ability'
import {AbilityUse} from '../nodes/ability-use'
import {ApplyAura, Damage, Heal, Interrupt, type Effect} from '../nodes/effects'
import {PeriodicAura} from '../nodes/periodic-aura'
import {BarrierAura} from '../nodes/barrier-aura'
import {roundOne} from '../utils'
import {abilityRegistry, type AbilityId} from '../nodes/registry'
import {registerTip} from './tooltip'
import {spellIconPath} from './icon-path'

export function abilityIconPath(AbilityClass: AbilityClass) {
	return spellIconPath(AbilityClass.icon || AbilityClass.name)
}

/** One button in the action bar: what the ability costs, what it does, and whether it can be used now. */
export function AbilityIcon(game: GameLoop, abilityId: string, shortcut: string | number) {
	const player = game.player
	const AbilityClass = player.abilities[abilityId]
	if (!AbilityClass) throw new Error(`no ability ${abilityId}`)

	const realCastTime = (game.elapsedTime || 0) - player.lastCastTime
	const gcdPercentage = realCastTime / game.gcd
	const angle = gcdPercentage ? (1 - gcdPercentage) * 360 : 0
	const refusal = AbilityUse.whyNotUse(player, AbilityClass, player.intendedTarget)
	const cooldownLeft = AbilityUse.cooldownRemaining(player, AbilityClass)
	const cooldown = AbilityClass.cooldown ?? 0
	const cooldownSweep = cooldown ? (cooldownLeft / cooldown) * 360 : 0
	// One number per effect the ability lands, so a composite reads as what it does.
	const magnitudes = AbilityClass.magnitudesFor(player).join(' + ') || 0
	const effect = AbilityClass.tags.includes('attack')
		? html`<span>🔴 ${magnitudes}</span>`
		: html`<span>🟢 ${magnitudes}</span>`

	let state = ''
	if (cooldownLeft > 0) state = 'cooldown'
	else if (refusal === 'missing-mana') state = 'unaffordable'
	else if (refusal) state = 'blocked'

	return html`
		<button
			class="Plate AbilityIcon"
			data-state=${state}
			data-tip=${`ability:${abilityId}`}
			data-tip-at="block-start"
			onclick=${() => game.perform({type: 'use', ability: abilityId})}
			.disabled=${game.gameOver}
		>
			<img class="Plate-image" src=${abilityIconPath(AbilityClass)} alt="" />
			<div class="Plate-inner">
				<h3>${AbilityClass.name}</h3>
				<p>
					<span>🔵 ${AbilityClass.cost ?? 0} </span>
					${effect}
					<span>⏲ ${(AbilityClass.castTime ?? 0) / 1000}s</span>
					${cooldown ? html`<span>⏳ ${cooldown / 1000}s</span>` : null}
				</p>
			</div>
			<div class="AbilityIcon-gcd" style=${`--progress: ${angle}deg`}></div>
			${cooldownLeft > 0
				? html`<div class="AbilityIcon-cooldown" style=${`--progress: ${cooldownSweep}deg`}>
						<strong>${Math.ceil(cooldownLeft / 1000)}</strong>
					</div>`
				: null}
			${shortcut ? html`<small class="AbilityIcon-shortcut">${shortcut}</small>` : null}
		</button>
	`
}

/** What kind of thing this is, under the name — school and the tags that tell it apart. */
function kindOf(AbilityClass: AbilityClass) {
	return [AbilityClass.school, ...AbilityClass.tags].join(' · ')
}

/** One effect line, sized for this caster the way the action bar is. */
function effectOf(effect: Effect, magnitude: number | undefined) {
	if (effect instanceof Heal) return html`<p class="Tooltip-effect">Heals ${magnitude}.</p>`
	if (effect instanceof Damage) return html`<p class="Tooltip-effect">Deals ${magnitude}.</p>`
	if (effect instanceof Interrupt) return html`<p class="Tooltip-effect">Interrupts casts on that side.</p>`
	if (effect instanceof ApplyAura) return plantedOf(effect.auraClass, magnitude ?? 0)
	return null
}

/** What an ApplyAura will leave behind, in the same voice the aura tip uses once it is up. */
function plantedOf(AuraClass: ApplyAura['auraClass'], magnitude: number) {
	if (AuraClass.prototype instanceof PeriodicAura || AuraClass === PeriodicAura) {
		const {interval, repeat, harms} = AuraClass as typeof PeriodicAura
		const verb = harms ? 'Deals' : 'Heals'
		const seconds = roundOne(interval / 1000)
		if (repeat <= 1) {
			return html`<p class="Tooltip-effect">${verb} ${magnitude} after ${seconds}s.</p>`
		}
		const instalment = Math.round(magnitude / repeat)
		return html`<p class="Tooltip-effect">${verb} ${instalment} every ${seconds}s — ${magnitude} in all.</p>`
	}
	if (AuraClass.prototype instanceof BarrierAura || AuraClass === BarrierAura) {
		const lifetime = roundOne((AuraClass as typeof BarrierAura).lifetime / 1000)
		return html`<p class="Tooltip-effect">Absorbs the next ${magnitude} damage for ${lifetime}s.</p>`
	}
	return html`<p class="Tooltip-effect">Applies ${AuraClass.name || AuraClass.id}.</p>`
}

function costLine(AbilityClass: AbilityClass) {
	const parts: string[] = []
	if (AbilityClass.cost) parts.push(`${AbilityClass.cost} mana`)
	const cast = (AbilityClass.castTime ?? 0) / 1000
	parts.push(cast > 0 ? `${cast}s cast` : 'instant')
	if (AbilityClass.cooldown) parts.push(`${AbilityClass.cooldown / 1000}s cooldown`)
	if (AbilityClass.gcd) parts.push('GCD')
	return parts.join(' · ')
}

/** The ability under the pointer, sized for the player as they are now. */
registerTip('ability', (abilityId, game) => {
	const AbilityClass: AbilityClass | undefined =
		game?.player?.abilities[abilityId] ?? abilityRegistry[abilityId as AbilityId]
	if (!AbilityClass || !game?.player) return null

	const magnitudes = AbilityClass.magnitudesFor(game.player)
	let next = 0
	const effects = AbilityClass.effects.map((effect) => {
		const sized = effect.coefficient === undefined ? undefined : magnitudes[next++]
		return effectOf(effect, sized)
	})

	const harmful = AbilityClass.tags.includes('attack')
	const target = AbilityClass.targets === 'ally' ? 'ally' : AbilityClass.targets === 'self' ? 'yourself' : 'enemy'

	return html`
		<article class=${`Tooltip-body ${harmful ? 'Tooltip-body--harmful' : 'Tooltip-body--helpful'}`}>
			<h3>${AbilityClass.name}</h3>
			<p class="Tooltip-kind">${kindOf(AbilityClass)}</p>
			${effects}
			${AbilityClass.sweetSpot
				? html`<p class="Tooltip-effect">Tap near the end of the cast for a stronger heal.</p>`
				: null}
			<footer>${costLine(AbilityClass)} · ${target}</footer>
		</article>
	`
})
