import {GameLoop} from '../nodes/game-loop'
import {html, render} from '../utils'
import {createLogger} from '../combatlog'

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

	constructor() {
		super()
		document.addEventListener('keydown', this.handleKeydown.bind(this))
	}

	init(game: GameLoop) {
		this.game = game
		this.setupCommands()
		this.render()

		// Add welcome messages
		this.logToConsole('WebHealer Developer Console. Blip blop')
	}

	connectedCallback() {
		if (this.shadowRoot && !this.shadowRoot.firstChild) {
			this.render()
		}
	}

	disconnectedCallback() {
		document.removeEventListener('keydown', this.handleKeydown.bind(this))
	}

	render() {
		if (!this.shadowRoot) return

		render(
			this.shadowRoot,
			() => html`
				<style>
					.DevConsole-output {
						flex: 1;
						overflow-y: auto;
						padding: 0.5em;
						line-height: 1.4;
						display: flex;
						flex-direction: column;
					}

					.DevConsole-inputWrapper {
						display: flex;
						align-items: center;
						background-color: var(--console-input-bg);
						border-top: 1px solid #444;
						padding: 0 8px;
					}

					.DevConsole-prefix {
						color: var(--console-text);
						padding-right: 4px;
					}

					.DevConsole-input {
						flex: 1;
						padding: 8px;
						background-color: transparent;
						color: var(--console-text);
						border: none;
						font-family: monospace;
						outline: none;
					}

					.DevConsole-output {
						flex-grow: 1;
						overflow-y: auto;
						padding: 10px;
						font-size: 14px;
						line-height: 1.4;
						display: flex;
						flex-direction: column;
						justify-content: flex-end;
						min-height: 0;
					}

					.DevConsole-output div {
						margin-bottom: 4px;
						word-wrap: break-word;
						opacity: 0.9;
						padding-left: 4px;
						border-left: 2px solid transparent;
					}

					.DevConsole-output div:first-child {
						margin-top: auto;
						/* Push content to the bottom */
					}

					.DevConsole-output div:has(+ div) {
						border-bottom: 1px solid rgba(255, 255, 255, 0.1);
						padding-bottom: 4px;
					}

					/* Style for command entries */
					.DevConsole-output div:first-line {
						color: #0f0;
					}

					.DevConsole-inputWrapper {
						display: flex;
						align-items: center;
						background-color: rgba(0, 0, 0, 0.6);
						border-top: 1px solid #555;
						padding: 8px 10px;
					}

					.DevConsole-inputWrapper span {
						margin-right: 5px;
						color: #0f0;
					}

					.DevConsole-input {
						flex-grow: 1;
						background: transparent;
						border: none;
						color: #fff;
						font-family: monospace;
						font-size: 14px;
						outline: none;
					}
				</style>
				<div class="DevConsole-output">
					<div style="flex-grow: 1; min-height: 0;"></div>
				</div>
				<div class="DevConsole-inputWrapper">
					<span class="DevConsole-prefix">/</span>
					<input
						type="text"
						class="DevConsole-input"
						placeholder="Type a command (e.g., /help)"
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

		// Enemy management command
		this.commands.set('enemies', {
			name: 'enemies',
			description: 'Manage enemies (removeall, spawn [type])',
			execute: (game, args) => {
				if (!args || args.length === 0) {
					this.logToConsole('Usage: /enemies removeall|spawn [type]')
					return
				}

				if (args[0] === 'removeall') {
					game.enemies = []
					this.logToConsole('All enemies removed')
				} else if (args[0] === 'spawn') {
					this.logToConsole('Spawn functionality coming soon')
				}
			},
		})

		// Heal command
		this.commands.set('heal', {
			name: 'heal',
			description: 'Heal all party members to full',
			execute: (game) => {
				game.party.forEach((member) => {
					member.health.current = member.health.max
				})
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

		// Speed command
		this.commands.set('speed', {
			name: 'speed',
			description: 'Set game speed (0.5-2)',
			execute: (game, args) => {
				if (!args || args.length === 0) {
					this.logToConsole('Usage: /speed [0.5-2]')
					return
				}

				const speed = parseFloat(args[0])
				if (isNaN(speed) || speed < 0.1 || speed > 5) {
					this.logToConsole('Speed must be between 0.1 and 5')
					return
				}

				game.speed = speed
				this.logToConsole(`Game speed set to ${speed}`)
			},
		})
	}

	toggleConsole() {
		this.toggleAttribute('hidden')

		// Focus input when showing
		if (!this.hasAttribute('hidden')) {
			setTimeout(() => {
				const input = this.shadowRoot?.querySelector(
					'.DevConsole-input',
				) as HTMLInputElement
				if (input) {
					input.focus()
					input.value = ''
				}
			}, 50)
		}
	}

	executeCommand(commandStr: string) {
		if (!commandStr) return

		// Add to history
		this.history.push(commandStr)
		this.historyIndex = this.history.length
		this.logToConsole(`> ${commandStr}`)

		// Log to combat log
		this.logger.info(`[DevConsole] Command executed: ${commandStr}`)

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
			this.logger.info(`[DevConsole] ${command} command executed successfully`)
		} else {
			this.logToConsole(`Unknown command: ${command}. Type /help for available commands.`)
			this.logger.warn(`[DevConsole] Unknown command attempted: ${command}`)
		}
	}

	/**
	 * Log a message to the console
	 */
	logToConsole(message: string) {
		const output = this.shadowRoot?.querySelector('.DevConsole-output')
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
	 * Handle global keydown for showing/hiding the console
	 */
	private handleKeydown(e: KeyboardEvent) {
		if (e.key === '`' || e.key === 'Escape') {
			this.toggleConsole()
		}
	}

	/**
	 * Navigate through command history
	 */
	private navigateHistory(direction: number, input: HTMLInputElement) {
		if (this.history.length === 0) return

		this.historyIndex = Math.max(
			0,
			Math.min(this.history.length - 1, this.historyIndex + direction),
		)
		input.value = this.history[this.historyIndex]

		// Move cursor to end of input
		setTimeout(() => {
			input.selectionStart = input.selectionEnd = input.value.length
		}, 0)
	}
}

// Register the web component
customElements.define('dev-console', DevConsole)
