import {html, render} from 'uhtml'
import {dungeonOrder, dungeonRegistry} from '../nodes/dungeon'
import {readJournal, subscribeJournal, type DungeonProgression} from '../journal'
import './floating-view.js'

/** How far a country reads, in the register the universe allows — no conquest words. */
function dungeonNote(progress: DungeonProgression) {
	if (progress.completed) return 'Mended.'
	if (!progress.unlocked) return 'Not walked yet'
	return `${progress.completedRoomCount} of ${progress.totalRoomCount} mended`
}

/**
 * The walk, as a panel: every dungeon and room the game holds, and how far along you are.
 * Progression comes from the Journal alone — fight history is never consulted.
 */
export class JournalView extends HTMLElement {
	private unsubscribe?: () => void

	connectedCallback() {
		this.unsubscribe = subscribeJournal(() => this.render())
		this.render()
	}

	disconnectedCallback() {
		this.unsubscribe?.()
		this.unsubscribe = undefined
	}

	render() {
		const journal = readJournal()
		const tpl = html`
			<div class="Journal">
				${dungeonOrder.map((dungeonId) => {
					const dungeon = dungeonRegistry[dungeonId]
					const progress = journal.dungeonProgression.find((candidate) => candidate.dungeonId === dungeonId)
					if (!progress) return ''
					const mended = new Set(progress.completedRoomIds)
					return html`
						<section class="Journal-dungeon" ?data-locked=${!progress.unlocked}>
							<header class="Journal-dungeonHead">
								<h3>${dungeon.name}</h3>
								<span class="Journal-note">${dungeonNote(progress)}</span>
							</header>
							<ol class="Journal-rooms">
								${dungeon.rooms.map((room, index) => {
									// One room is "here": the room this dungeon would start you in.
									const state = mended.has(room.id)
										? 'mended'
										: progress.unlocked && index === progress.firstUnmendedRoomIndex
											? 'here'
											: 'ahead'
									return html`
										<li class="Journal-room" data-state=${state}>
											<i class="Journal-dot"></i>
											<span class="Journal-roomName">${room.name ?? room.id}</span>
											<em class="Journal-note">${state === 'mended' ? 'Mended.' : state === 'here' ? 'here' : ''}</em>
										</li>
									`
								})}
							</ol>
						</section>
					`
				})}
				<p class="Journal-craft">
					Your hands know: ${journal.learnedAbilities.length ? journal.learnedAbilities.join(', ') : 'nothing yet'}
				</p>
			</div>
		`
		render(this, () => tpl)
	}
}

customElements.define('journal-view', JournalView)
