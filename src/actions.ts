import {log} from './utils'
import {AudioPlayer} from './nodes/audio'
import {GameLoop} from './nodes/game-loop'

export function interrupt(game: GameLoop) {
	log('interrupt')

	const player = game.player

	if (player.spell) AudioPlayer.stopOwned(player.spell)
	AudioPlayer.play('spell_fizzle')

	// Now disconnect the spell and GCD tasks
	player.spell?.disconnect()
	player.gcd?.disconnect()

	// Clean up all references
	player.spell = undefined
	player.gcd = undefined
}
