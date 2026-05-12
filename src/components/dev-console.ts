import {GameLoop} from '../nodes/game-loop'
import {html, render} from '../utils'
import {createLogger} from '../combatlog'
import {commands} from '../commands'
import {SPELL_KEYS, ATTACK_KEYS, UNIT_KEYS, SpellKey, AttackKey, UnitKey} from '../balance'
import {EnemyId, enemyRegistry} from '../nodes/registry'

/**
 * Interface for console commands
 */
export interface Command {
	name: string
	description: string
	execute: (game: GameLoop, args?: string[]) => void
}

/**
 * Developer Console web component
 */
export class DevConsole extends HTMLElement {
	private commands = new Map<string, Command>()
	private game!: GameLoop
	private history: string[] = []
	private historyIndex = 0
	private logger = createLogger('info')
	private floatingView: HTMLElement | null = null

	init(game: GameLoop) {
		this.game = game
		this.setupCommands()
		this.render()

		// Find the floating view container
		this.floatingView = this.closest('floating-view')

		// Add welcome messages
		// this.logToConsole('WebHealer Developer Console. Blip blop')
	}

	connectedCallback() {
		if (!this.firstChild) {
			this.render()
		}
	}

	toggleConsole() {
		const view = this.floatingView ?? this.closest('floating-view')
		if (!view) return

		// If minimized, restore it
		if (view.hasAttribute('minimized')) {
			view.removeAttribute('minimized')
			view.style.height = 'auto'
			setTimeout(() => {
				const input = this.querySelector('.DevConsole-input') as HTMLInputElement
				input?.focus()
			}, 50)
		}
		// If already visible, minimize it
		else {
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
		// Help command
		this.commands.set('help', {
			name: 'help',
			description: 'Show available commands',
			execute: () => {
				const commandHelp = Array.from(this.commands.values())
					.map((cmd) => `/${cmd.name} - ${cmd.description}`)
					.join('\n')
				this.logToConsole('Available commands:\n' + commandHelp)
			},
		})

		// God mode command
		this.commands.set('godmode', {
			name: 'godmode',
			description: 'Toggle invulnerability for players',
			execute: (game) => {
				game.godMode = !game.godMode
				this.logToConsole(`God mode ${game.godMode ? 'enabled' : 'disabled'}`)
			},
		})

		// Infinite mana command
		this.commands.set('infinitemana', {
			name: 'infinitemana',
			description: 'Toggle infinite mana for the player',
			execute: (game) => {
				game.infiniteMana = !game.infiniteMana
				if (game.infiniteMana && game.player && game.player.mana) {
					game.player.mana.current = game.player.mana.max
				}
				this.logToConsole(`Infinite mana ${game.infiniteMana ? 'enabled' : 'disabled'}`)
			},
		})

		// Enemy management command — /enemy spawn <Type> | /enemy remove <id> | /enemy removeall
		this.commands.set('enemy', {
			name: 'enemy',
			description: 'Manage enemies: spawn <Type> | remove <id> | removeall',
			execute: (game, args) => {
				if (!args || args.length === 0) {
					this.logToConsole(
						`Usage: /enemy spawn <Type> | /enemy remove <id> | /enemy removeall\nTypes: ${Object.keys(enemyRegistry).join(', ')}`,
					)
					return
				}
				if (args[0] === 'removeall') {
					for (const e of game.encounter.enemies.slice()) commands.removeUnit(game, e.id)
					this.logToConsole('All enemies removed')
				} else if (args[0] === 'spawn') {
					const type = args[1] as EnemyId
					if (!type || !(type in enemyRegistry)) {
						this.logToConsole(`Unknown enemy type. Known: ${Object.keys(enemyRegistry).join(', ')}`)
						return
					}
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
		})

		// Spell tuning — /spell <Name> <key> <value>. Multi-word names need underscores: Flash_Heal.
		this.commands.set('spell', {
			name: 'spell',
			description: 'Tune a spell: /spell <Name> <key> <value> (e.g. /spell Heal cost 55)',
			execute: (game, args) => {
				if (!args || args.length < 3) {
					this.logToConsole(`Usage: /spell <Name> <key> <value>\nKeys: ${SPELL_KEYS.join(', ')}`)
					return
				}
				const name = args[0].replaceAll('_', ' ')
				const key = args[1] as SpellKey
				const value = Number(args[2])
				if (!(SPELL_KEYS as readonly string[]).includes(key) || !Number.isFinite(value)) {
					this.logToConsole(`Invalid key or value. Keys: ${SPELL_KEYS.join(', ')}`)
					return
				}
				const ok = commands.setSpell(game, name, key, value)
				this.logToConsole(ok ? `${name}.${key} = ${value}` : `Unknown spell: ${name}`)
			},
		})

		// Attack tuning — /attack <Name> <key> <value>
		this.commands.set('attack', {
			name: 'attack',
			description: 'Tune an attack: /attack <Name> <key> <value>',
			execute: (game, args) => {
				if (!args || args.length < 3) {
					this.logToConsole(`Usage: /attack <Name> <key> <value>\nKeys: ${ATTACK_KEYS.join(', ')}`)
					return
				}
				const [name, key, valueStr] = args
				const value = Number(valueStr)
				if (!(ATTACK_KEYS as readonly string[]).includes(key as AttackKey) || !Number.isFinite(value)) {
					this.logToConsole(`Invalid key or value. Keys: ${ATTACK_KEYS.join(', ')}`)
					return
				}
				const ok = commands.setAttack(game, name, key as AttackKey, value)
				this.logToConsole(ok ? `${name}.${key} = ${value}` : `Unknown attack: ${name}`)
			},
		})

		// Unit tuning — /unit <Name> <key> <value>
		this.commands.set('unit', {
			name: 'unit',
			description: 'Tune a unit: /unit <Name> <key> <value>',
			execute: (game, args) => {
				if (!args || args.length < 3) {
					this.logToConsole(`Usage: /unit <Name> <key> <value>\nKeys: ${UNIT_KEYS.join(', ')}`)
					return
				}
				const [name, key, valueStr] = args
				const value = Number(valueStr)
				if (!(UNIT_KEYS as readonly string[]).includes(key as UnitKey) || !Number.isFinite(value)) {
					this.logToConsole(`Invalid key or value. Keys: ${UNIT_KEYS.join(', ')}`)
					return
				}
				const ok = commands.setUnit(game, name, key as UnitKey, value)
				this.logToConsole(ok ? `${name}.${key} = ${value}` : `Unknown unit: ${name}`)
			},
		})

		// Balance management — /balance reset
		this.commands.set('balance', {
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
		})

		// Heal command
		this.commands.set('heal', {
			name: 'heal',
			description: 'Heal all party members to full',
			execute: (game) => {
				commands.healParty(game)
				this.logToConsole('All party members healed to full')
			},
		})

		// Reset command
		this.commands.set('reset', {
			name: 'reset',
			description: 'Reset the game state',
			execute: () => {
				location.reload()
			},
		})
	}

	executeCommand(commandStr: string) {
		if (!commandStr) return

		// Add to history
		this.history.push(commandStr)
		this.historyIndex = this.history.length
		this.logToConsole(`> ${commandStr}`)

		// Log to combat log
		this.logger.info(`[console] Command executed: ${commandStr}`)

		// Process the command
		const cmdStr = commandStr.startsWith('/') ? commandStr.substring(1) : commandStr
		const parts = cmdStr.split(' ')
		const command = parts[0].toLowerCase()
		const args = parts.slice(1)

		// Execute if command exists
		const cmd = this.commands.get(command)
		if (cmd) {
			cmd.execute(this.game, args)

			// Log the result to combat log
			this.logger.info(`[console] ${command} command executed successfully`)
		} else {
			this.logToConsole(`Unknown command: ${command}. Type /help for available commands.`)
			this.logger.warn(`[console] Unknown command attempted: ${command}`)
		}
	}

	/**
	 * Log a message to the console
	 */
	logToConsole(message: string) {
		const output = this.querySelector('.DevConsole-output')
		if (!output) return

		message.split('\n').forEach((line) => {
			const lineElement = document.createElement('div')
			lineElement.textContent = line
			output.appendChild(lineElement)
		})

		// Auto-scroll to bottom
		output.scrollTop = output.scrollHeight
	}

	/**
	 * Handle input keydown events
	 */
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

	/**
	 * Navigate through command history
	 */
	private navigateHistory(direction: number, input: HTMLInputElement) {
		if (this.history.length === 0) return

		this.historyIndex = Math.max(0, Math.min(this.history.length - 1, this.historyIndex + direction))
		input.value = this.history[this.historyIndex]

		// Move cursor to end of input
		setTimeout(() => {
			input.selectionStart = input.selectionEnd = input.value.length
		}, 0)
	}
}

// Register the web component
customElements.define('dev-console', DevConsole)
