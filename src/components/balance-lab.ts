import {html, render} from '../utils'
import type {GameLoop} from '../nodes/game-loop'
import {balance, SPELL_KEYS, UNIT_KEYS, SpellKey, UnitKey} from '../balance'
import {commands} from '../commands'

const SPELL_LABEL: Record<SpellKey, string> = {
	cost: 'Mana cost',
	heal: 'Heal amount',
	castTime: 'Cast time (ms)',
}

const UNIT_LABEL: Record<UnitKey, string> = {
	maxHealth: 'Max health',
}

export class BalanceLab extends HTMLElement {
	private game: GameLoop | null = null
	private _boundHandleLogUpdate = () => this.render()

	init(game: GameLoop) {
		this.game = game
		this.render()
	}

	connectedCallback() {
		document.addEventListener('combatlog-update', this._boundHandleLogUpdate)
		if (!this.firstChild) this.render()
	}

	disconnectedCallback() {
		document.removeEventListener('combatlog-update', this._boundHandleLogUpdate)
	}

	private onNumber(handler: (value: number) => void) {
		return (e: Event) => {
			const value = (e.target as HTMLInputElement).valueAsNumber
			if (!Number.isFinite(value)) return
			handler(value)
			this.render()
		}
	}

	render() {
		const game = this.game
		if (!game) {
			render(this, () => html`<p>Waiting for game…</p>`)
			return
		}

		const heal = balance.spells['Heal']
		const wolf = balance.units['TinyWolf']
		const liveWolves = game.encounter.enemies.filter((e) => e.constructor.name === 'TinyWolf')

		render(
			this,
			() => html`
				<section>
					<h3>Spell — Heal</h3>
					<dl>
						${SPELL_KEYS.map(
							(k) => html`
								<dt>${SPELL_LABEL[k]}</dt>
								<dd>
									<input
										type="number"
										.value=${String(heal[k])}
										onchange=${this.onNumber((v) => commands.setSpell(game, 'Heal', k, v))}
									/>
								</dd>
							`,
						)}
					</dl>
				</section>

				<section>
					<h3>Enemy — TinyWolf</h3>
					<dl>
						${UNIT_KEYS.map(
							(k) => html`
								<dt>${UNIT_LABEL[k]}</dt>
								<dd>
									<input
										type="number"
										.value=${String(wolf[k])}
										onchange=${this.onNumber((v) => commands.setUnit(game, 'TinyWolf', k, v))}
									/>
								</dd>
							`,
						)}
					</dl>
					<p>
						<button
							onclick=${() => {
								commands.spawnEnemy(game, 'TinyWolf')
								this.render()
							}}
						>
							Spawn TinyWolf
						</button>
					</p>
					<p>Live (${liveWolves.length}):</p>
					<ul>
						${liveWolves.map(
							(w) => html`
								<li>
									${w.id.slice(-6)} — ${w.health.current}/${w.health.max}
									<button
										onclick=${() => {
											commands.removeUnit(game, w.id)
											this.render()
										}}
									>
										Remove
									</button>
								</li>
							`,
						)}
					</ul>
				</section>

				<section>
					<button
						onclick=${() => {
							commands.healParty(game)
							this.render()
						}}
					>
						Heal party
					</button>
					<button
						onclick=${() => {
							commands.resetBalance(game)
							this.render()
						}}
					>
						Reset balance
					</button>
				</section>
			`,
		)
	}
}

customElements.define('balance-lab', BalanceLab)
