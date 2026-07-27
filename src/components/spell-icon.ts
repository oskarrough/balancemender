import {html} from '../utils'
import {GameLoop} from '../nodes/game-loop'
import {Spell} from '../nodes/spell'
import {SpellCast} from '../nodes/spell-cast'

/** From the display name, not the id: the files on disk are `flash-heal.png`. */
function spellIconPath(SpellClass: typeof Spell) {
	const slug = SpellClass.icon || SpellClass.name.toLowerCase().replaceAll(' ', '-')
	return `/assets/generated/spells/${slug}.png`
}

export function SpellIcon(game: GameLoop, spellId: string, shortcut: string | number) {
	const player = game.player
	const SpellClass = player.spellbook[spellId] as typeof Spell

	if (!SpellClass) throw new Error('no spell' + spellId)

	// Readable cast time
	/* const beingCast = player.lastCastSpell instanceof spells.Spell */
	const realCastTime = (game?.elapsedTime || 0) - player.lastCastTime
	/* const castTime = beingCast */
	/* 	? roundOne(realCastTime / 1000) */
	/* 	: roundOne(spell.delay / 1000) */

	// Circular-progress UI
	const gcdPercentage = realCastTime / game.gcd
	const angle = gcdPercentage ? (1 - gcdPercentage) * 360 : 0

	/**
	 * `whyNotCast` and deliberately not `validate`: the other half is about the player, not the
	 * spell, so it is the same for every icon and turns over within a second of every cast. Drawing
	 * it here would strobe the whole bar and tell the player nothing.
	 */
	const refusal = SpellCast.whyNotCast(player, SpellClass)
	const cooldownLeft = SpellCast.cooldownRemaining(player, SpellClass)
	// Guarded, because tuning a cooldown to 0 while one is already running would divide by it.
	const cooldownSweep = SpellClass.cooldown ? (cooldownLeft / SpellClass.cooldown) * 360 : 0

	let state = ''
	if (cooldownLeft > 0) state = 'cooldown'
	else if (refusal === 'missing-mana') state = 'unaffordable'
	else if (refusal) state = 'blocked'

	/**
	 * Not `disabled` — that is the trap this issue set for itself. A disabled button swallows the
	 * click, and the click is what produces the refusal message that says *why* nothing happened.
	 * So an unavailable spell looks unavailable and stays pressable, and pressing it explains
	 * itself. Only game over truly disables anything.
	 */
	return html`
		<button
			class="Spell"
			data-state=${state}
			onclick=${() => game.perform({type: 'cast', spell: spellId})}
			.disabled=${game.gameOver}
		>
			<img class="Spell-image" src=${spellIconPath(SpellClass)} alt="" />
			<div class="Spell-inner">
				<h3>${SpellClass.name}</h3>
				<p>
					<span>🔵 ${SpellClass.cost} </span>
					<span>🟢 ${SpellClass.heal}</span>
					<span>⏲ ${SpellClass.castTime / 1000}s</span>
					${SpellClass.cooldown ? html`<span>⏳ ${SpellClass.cooldown / 1000}s</span>` : null}
				</p>
			</div>
			<div class="Spell-gcd" style=${`--progress: ${angle}deg`}></div>
			${cooldownLeft > 0
				? html`<div class="Spell-cooldown" style=${`--progress: ${cooldownSweep}deg`}>
						<strong>${Math.ceil(cooldownLeft / 1000)}</strong>
					</div>`
				: null}
			${shortcut ? html`<small class="Spell-shortcut">${shortcut}</small>` : html``}
		</button>
	`
}
