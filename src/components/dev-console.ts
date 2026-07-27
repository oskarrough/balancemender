import {GameLoop} from '../nodes/game-loop'
import {html, render} from '../utils'
import {createLogger} from '../combatlog'
import {balanceCategories} from '../balance'
import type {BalanceKind} from '../balance'
import {unitIds, UnitId} from '../nodes/unit-registry'
import type {GameAction} from '../actions'
import type {Character} from '../nodes/character'

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

	/** Parse `<Name> <key> <value>` and hand it to the interpreter. All three tune commands are this. */
	private tuneCommand<K extends string>(of: BalanceKind, keys: readonly K[]): Command {
		const log = (msg: string) => this.logToConsole(msg)
		return {
			name: of,
			description: `Tune a ${of}: /${of} <Name> <key> <value>`,
			execute: (game, args) => {
				if (!args || args.length < 3) return log(`Usage: /${of} <Name> <key> <value>\nKeys: ${keys.join(', ')}`)
				const name = args[0].replaceAll('_', ' ')
				const key = args[1] as K
				const value = Number(args[2])
				if (!(keys as readonly string[]).includes(key) || !Number.isFinite(value)) {
					return log(`Invalid key or value. Keys: ${keys.join(', ')}`)
				}
				const result = game.perform({type: 'tune', of, name, key, value} as GameAction)
				log(result.ok ? `${name}.${key} = ${value}` : result.error)
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
					game.perform({type: 'set', key: 'godMode', value: !game.godMode})
					this.logToConsole(`God mode ${game.godMode ? 'enabled' : 'disabled'}`)
				},
			},
			{
				name: 'infinitemana',
				description: 'Toggle infinite mana for the player',
				execute: (game) => {
					game.perform({type: 'set', key: 'infiniteMana', value: !game.infiniteMana})
					this.logToConsole(`Infinite mana ${game.infiniteMana ? 'enabled' : 'disabled'}`)
				},
			},
			{
				name: 'enemy',
				description: 'Manage enemies: spawn <Type> | remove <id> | removeall',
				execute: (game, args) => {
					// The console offers enemies only; `spawn` itself is happy to make anyone.
					const known = unitIds('enemy')
					const types = known.join(', ')
					if (!args || args.length === 0) {
						return this.logToConsole(
							`Usage: /enemy spawn <Type> | /enemy remove <id> | /enemy removeall\nTypes: ${types}`,
						)
					}
					if (args[0] === 'removeall') {
						for (const e of game.encounter.enemies.slice()) game.perform({type: 'remove', unit: e.id})
						this.logToConsole('All enemies removed')
					} else if (args[0] === 'spawn') {
						const unit = args[1] as UnitId
						if (!unit || !known.includes(unit)) return this.logToConsole(`Unknown enemy type. Known: ${types}`)
						const result = game.perform({type: 'spawn', unit})
						this.logToConsole(
							result.ok ? `Spawned ${unit} (${(result.value as Character).id.slice(-6)})` : result.error,
						)
					} else if (args[0] === 'remove') {
						const id = args[1]
						if (!id) return this.logToConsole('Usage: /enemy remove <id>')
						const result = game.perform({type: 'remove', unit: id})
						this.logToConsole(result.ok ? `Removed ${id}` : result.error)
					} else {
						this.logToConsole(`Unknown subcommand: ${args[0]}`)
					}
				},
			},
			// Every tunable kind gets a command, from the same table `--tune` reads. Hand-listing
			// these is how `effect` came to be tunable from a terminal and not from the game.
			...Object.entries(balanceCategories).map(([kind, category]) =>
				this.tuneCommand(kind as BalanceKind, category.keys),
			),
			{
				name: 'balance',
				description: 'Balance ops: reset',
				execute: (game, args) => {
					if (args?.[0] === 'reset') {
						game.perform({type: 'resetBalance'})
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
					game.perform({type: 'healParty'})
					this.logToConsole('All party members healed to full')
				},
			},
			{
				name: 'cast',
				description: 'Cast a spell: /cast <Spell_Name>',
				execute: (game, args) => {
					if (!args?.length) return this.logToConsole('Usage: /cast <Spell_Name>')
					const spell = args.join(' ').replaceAll('_', ' ')
					const result = game.perform({type: 'cast', spell})
					this.logToConsole(result.ok ? `Casting ${spell}` : result.error)
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
