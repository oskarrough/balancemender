import {GameLoop} from '../nodes/game-loop'
import {html, render} from '../utils'
import {createLogger} from '../combatlog'
import {commands} from '../commands'
import {SPELL_KEYS, ATTACK_KEYS, UNIT_KEYS, SpellKey, AttackKey, UnitKey} from '../balance'
import {EnemyId, enemyRegistry} from '../nodes/registry'

export interface Command {
	name: string
	description: string
	execute: (game: GameLoop, args?: string[]) => void
}

export class DevConsole extends HTMLElement {
	private commands = new Map<string, Command>()
	private game!: GameLoop
	private history: string[] = []
	private historyIndex = 0
	private logger = createLogger('info')

	init(game: GameLoop) {
		this.game = game
		this.setupCommands()
		this.render()
	}

	private tuneCommand<K extends string>(
		name: string,
		keys: readonly K[],
		setter: (game: GameLoop, n: string, k: K, v: number) => boolean,
	): Command {
		const log = (msg: string) => this.logToConsole(msg)
		return {
			name,
			description: `Tune a ${name}: /${name} <Name> <key> <value>`,
			execute: (game, args) => {
				if (!args || args.length < 3) return log(`Usage: /${name} <Name> <key> <value>\nKeys: ${keys.join(', ')}`)
				const targetName = args[0].replaceAll('_', ' ')
				const key = args[1] as K
				const value = Number(args[2])
				if (!(keys as readonly string[]).includes(key) || !Number.isFinite(value)) {
					return log(`Invalid key or value. Keys: ${keys.join(', ')}`)
				}
				const ok = setter(game, targetName, key, value)
				log(ok ? `${targetName}.${key} = ${value}` : `Unknown ${name}: ${targetName}`)
			},
		}
	}

	connectedCallback() {
		if (!this.firstChild) this.render()
	}

	toggleConsole() {
		const view = this.closest('floating-view')
		if (!view) return
		if (view.hasAttribute('minimized')) {
			view.removeAttribute('minimized')
			;(view as HTMLElement).style.height = 'auto'
			setTimeout(() => {
				const input = this.querySelector('.DevConsole-input') as HTMLInputElement
				input?.focus()
			}, 50)
		} else {
			view.setAttribute('minimized', '')
		}
	}

	render() {
		render(
			this,
			() => html`
				<div class="DevConsole-output">
					<div style="flex-grow: 1; min-height: 0;"></div>
				</div>
				<div class="DevConsole-inputWrapper">
					<span class="DevConsole-prefix">~</span>
					<input
						type="text"
						class="DevConsole-input"
						placeholder="Type a command (e.g., help)"
						onkeydown=${this.handleInputKeydown}
					/>
				</div>
			`,
		)
	}

	private setupCommands() {
		const list: Command[] = [
			{
				name: 'help',
				description: 'Show available commands',
				execute: () => {
					const helpText = Array.from(this.commands.values())
						.map((cmd) => `/${cmd.name} - ${cmd.description}`)
						.join('\n')
					this.logToConsole('Available commands:\n' + helpText)
				},
			},
			{
				name: 'godmode',
				description: 'Toggle invulnerability for players',
				execute: (game) => {
					game.godMode = !game.godMode
					this.logToConsole(`God mode ${game.godMode ? 'enabled' : 'disabled'}`)
				},
			},
			{
				name: 'infinitemana',
				description: 'Toggle infinite mana for the player',
				execute: (game) => {
					game.infiniteMana = !game.infiniteMana
					if (game.infiniteMana && game.player?.mana) game.player.mana.current = game.player.mana.max
					this.logToConsole(`Infinite mana ${game.infiniteMana ? 'enabled' : 'disabled'}`)
				},
			},
			{
				name: 'enemy',
				description: 'Manage enemies: spawn <Type> | remove <id> | removeall',
				execute: (game, args) => {
					const types = Object.keys(enemyRegistry).join(', ')
					if (!args || args.length === 0) {
						return this.logToConsole(
							`Usage: /enemy spawn <Type> | /enemy remove <id> | /enemy removeall\nTypes: ${types}`,
						)
					}
					if (args[0] === 'removeall') {
						for (const e of game.encounter.enemies.slice()) commands.removeUnit(game, e.id)
						this.logToConsole('All enemies removed')
					} else if (args[0] === 'spawn') {
						const type = args[1] as EnemyId
						if (!type || !(type in enemyRegistry)) return this.logToConsole(`Unknown enemy type. Known: ${types}`)
						const e = commands.spawnEnemy(game, type)
						this.logToConsole(e ? `Spawned ${type} (${e.id.slice(-6)})` : `Failed to spawn ${type}`)
					} else if (args[0] === 'remove') {
						const id = args[1]
						if (!id) return this.logToConsole('Usage: /enemy remove <id>')
						const ok = commands.removeUnit(game, id)
						this.logToConsole(ok ? `Removed ${id}` : `Not found: ${id}`)
					} else {
						this.logToConsole(`Unknown subcommand: ${args[0]}`)
					}
				},
			},
			this.tuneCommand<SpellKey>('spell', SPELL_KEYS, (g, n, k, v) => commands.setSpell(g, n, k, v)),
			this.tuneCommand<AttackKey>('attack', ATTACK_KEYS, (g, n, k, v) => commands.setAttack(g, n, k, v)),
			this.tuneCommand<UnitKey>('unit', UNIT_KEYS, (g, n, k, v) => commands.setUnit(g, n, k, v)),
			{
				name: 'balance',
				description: 'Balance ops: reset',
				execute: (game, args) => {
					if (args?.[0] === 'reset') {
						commands.resetBalance(game)
						this.logToConsole('Balance reset to defaults')
					} else {
						this.logToConsole('Usage: /balance reset')
					}
				},
			},
			{
				name: 'heal',
				description: 'Heal all party members to full',
				execute: (game) => {
					commands.healParty(game)
					this.logToConsole('All party members healed to full')
				},
			},
			{
				name: 'reset',
				description: 'Reset the game state',
				execute: () => location.reload(),
			},
		]
		for (const cmd of list) this.commands.set(cmd.name, cmd)
	}

	executeCommand(commandStr: string) {
		if (!commandStr) return
		this.history.push(commandStr)
		this.historyIndex = this.history.length
		this.logToConsole(`> ${commandStr}`)
		this.logger.info(`[console] Command executed: ${commandStr}`)

		const cmdStr = commandStr.startsWith('/') ? commandStr.substring(1) : commandStr
		const parts = cmdStr.split(' ')
		const command = parts[0].toLowerCase()
		const args = parts.slice(1)

		const cmd = this.commands.get(command)
		if (cmd) {
			cmd.execute(this.game, args)
		} else {
			this.logToConsole(`Unknown command: ${command}. Type /help for available commands.`)
			this.logger.warn(`[console] Unknown command attempted: ${command}`)
		}
	}

	logToConsole(message: string) {
		const output = this.querySelector('.DevConsole-output')
		if (!output) return
		for (const line of message.split('\n')) {
			const el = document.createElement('div')
			el.textContent = line
			output.appendChild(el)
		}
		output.scrollTop = output.scrollHeight
	}

	private handleInputKeydown = (e: KeyboardEvent) => {
		const input = e.target as HTMLInputElement
		if (e.key === 'Enter' && input.value.trim()) {
			this.executeCommand(input.value.trim())
			input.value = ''
		} else if (e.key === 'ArrowUp') {
			this.navigateHistory(-1, input)
			e.preventDefault()
		} else if (e.key === 'ArrowDown') {
			this.navigateHistory(1, input)
			e.preventDefault()
		}
	}

	private navigateHistory(direction: number, input: HTMLInputElement) {
		if (this.history.length === 0) return
		this.historyIndex = Math.max(0, Math.min(this.history.length - 1, this.historyIndex + direction))
		input.value = this.history[this.historyIndex]
		setTimeout(() => {
			input.selectionStart = input.selectionEnd = input.value.length
		}, 0)
	}
}

customElements.define('dev-console', DevConsole)
