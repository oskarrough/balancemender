import {render, type Hole} from 'uhtml'
import {currentGame, type GameLoop} from '../nodes/game-loop'

/**
 * One tooltip for the whole game, in the top layer, anchored by CSS.
 *
 * An element claims it with `data-tip="kind:rest"` and a component registers what `kind` draws.
 * The attribute holds a reference, never rendered text: the body is redrawn every frame with the
 * rest of the UI, so a cooldown ticking down or an aura falling off is right on the frame you
 * read it. Content that resolves to nothing closes the tooltip, which is also what happens when
 * the thing you were hovering leaves the fight under your cursor.
 */

const TIP_ID = 'tooltip'

/** Draws one `data-tip` kind. `rest` is whatever followed the first colon. */
type TipRenderer = (rest: string, game: GameLoop | undefined) => Hole | null

const renderers: Record<string, TipRenderer> = {}

/** Components register their own tooltip next to the icon it belongs to. */
export function registerTip(kind: string, renderer: TipRenderer) {
	renderers[kind] = renderer
}

let element: HTMLElement | undefined
let anchor: HTMLElement | undefined
let installed = false

function tooltipElement() {
	if (element) return element
	element = document.createElement('div')
	element.id = TIP_ID
	element.className = 'Tooltip'
	// Safari has no `hint` yet and falls back to `manual`, which is what we drive anyway.
	element.popover = 'hint'
	element.role = 'tooltip'
	document.body.append(element)
	return element
}

/**
 * Point the tooltip at an element, or at nothing.
 *
 * The anchor name lives in CSS on `[data-tip-open]` rather than an inline style, because uhtml
 * rewrites the `style` attribute of anything it draws and would wipe it every frame.
 */
function setAnchor(next: HTMLElement | undefined) {
	if (next === anchor) return
	anchor?.removeAttribute('data-tip-open')
	anchor?.removeAttribute('aria-describedby')
	anchor = next
	anchor?.setAttribute('data-tip-open', '')
	anchor?.setAttribute('aria-describedby', TIP_ID)
	// Which side to prefer is the anchor's to say — an action bar at the foot of the screen wants
	// above, an aura chip wedged between two frames wants below. Fallbacks still flip either.
	tooltipElement().dataset.at = anchor?.dataset.tipAt ?? 'block-end'
	// Don't wait for the next frame — a paused game has none, and pausing to read is the point.
	drawTooltip()
}

function tipTarget(node: EventTarget | null) {
	const element = node instanceof Element ? node.closest<HTMLElement>('[data-tip]') : null
	return element ?? undefined
}

/**
 * One delegated listener per event, so a UI that rebuilds itself every frame costs nothing here.
 *
 * Hover and focus are kept apart rather than both writing the anchor: clicking a unit frame moves
 * focus to the game, and a shared anchor would read that as "closed" while the pointer is still
 * sitting on the chip. The pointer wins when it is on something, since it is the deliberate one.
 */
export function installTooltips() {
	if (installed) return
	installed = true
	tooltipElement()
	let hovered: HTMLElement | undefined
	let focused: HTMLElement | undefined
	const sync = () => setAnchor(hovered ?? focused)
	// `pointerover` fires on the way in *and* on the way out — the element left for is the new
	// anchor, and moving onto anything without a `data-tip` resolves to none.
	document.addEventListener('pointerover', (event) => {
		hovered = tipTarget(event.target)
		sync()
	})
	document.documentElement.addEventListener('pointerleave', () => {
		hovered = undefined
		sync()
	})
	document.addEventListener('focusin', (event) => {
		focused = tipTarget(event.target)
		sync()
	})
	document.addEventListener('focusout', () => {
		focused = undefined
		sync()
	})
	document.addEventListener('keydown', (event) => {
		if (event.key !== 'Escape') return
		hovered = undefined
		focused = undefined
		sync()
	})
}

function close() {
	const tooltip = tooltipElement()
	if (tooltip.matches(':popover-open')) tooltip.hidePopover()
}

/** Redraw whatever is open. Called once a frame from the game's `draw`. */
export function drawTooltip(game = currentGame()) {
	if (!anchor) return close()
	// The unit frame that owned the anchor may have been diffed away since the pointer landed.
	if (!anchor.isConnected) {
		setAnchor(undefined)
		return close()
	}
	const tip = anchor.dataset.tip ?? ''
	const split = tip.indexOf(':')
	const content = split < 0 ? null : (renderers[tip.slice(0, split)]?.(tip.slice(split + 1), game) ?? null)
	if (!content) return close()
	const tooltip = tooltipElement()
	render(tooltip, content)
	if (!tooltip.matches(':popover-open')) tooltip.showPopover()
}
