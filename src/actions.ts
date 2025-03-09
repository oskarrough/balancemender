import {log} from './utils'
import {AudioPlayer} from './nodes/audio'
import {GameLoop} from './nodes/game-loop'

export function interrupt(game: GameLoop) {
	log('interrupt')

	const player = game.player
	player.spell?.stopSounds?.()
	
	const audio = AudioPlayer.play('spell.fizzle')
	if (!audio) {
		log('interrupt: failed to play fizzle sound!')
	}

	player.spell?.disconnect()
	player.gcd?.disconnect()

	player.spell = undefined
	player.gcd = undefined
}
