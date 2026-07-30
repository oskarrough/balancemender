import {html, render} from 'uhtml'
import type {Inspectable, Field} from '../inspectables'

export class BalanceInspector extends HTMLElement {
	private target: Inspectable | null = null

	setTarget(target: Inspectable | null) {
		this.target = target
		this.render()
	}

	connectedCallback() {
		if (!this.firstChild) this.render()
	}

	private renderField = (f: Field) => {
		if (f.kind === 'boolean') {
			return html`
				<label class="BalanceInspector-row">
					<span>${f.label}</span>
					<input
						type="checkbox"
						.checked=${f.get()}
						onchange=${(e: Event) => {
							f.set((e.target as HTMLInputElement).checked)
							this.render()
						}}
					/>
				</label>
			`
		}
		return html`
			<label class="BalanceInspector-row">
				<span>${f.label}</span>
				<input
					type="number"
					step=${f.step ?? 1}
					min=${f.min ?? ''}
					.value=${String(f.get())}
					onchange=${(e: Event) => {
						const v = (e.target as HTMLInputElement).valueAsNumber
						if (!Number.isFinite(v)) return
						f.set(v)
						this.render()
					}}
				/>
			</label>
		`
	}

	render() {
		const t = this.target
		if (!t) {
			render(this, () => html`<p class="BalanceInspector-empty">Select something to edit.</p>`)
			return
		}
		render(
			this,
			() => html`
				<header class="BalanceInspector-header">
					<h3>${t.title}</h3>
					${t.subtitle ? html`<small>${t.subtitle}</small>` : ''}
				</header>
				<div class="BalanceInspector-fields">${t.fields.map(this.renderField)}</div>
				${t.actions?.length
					? html`
							<div class="BalanceInspector-actions">
								${t.actions.map(
									(a) => html`
										<button
											class=${`BalanceInspector-action is-${a.variant ?? 'default'}`}
											onclick=${() => {
												a.run()
												this.render()
											}}
										>
											${a.label}
										</button>
									`,
								)}
							</div>
						`
					: ''}
			`,
		)
	}
}

customElements.define('balance-inspector', BalanceInspector)
