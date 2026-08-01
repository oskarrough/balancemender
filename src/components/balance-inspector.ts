import {html, render} from 'uhtml'
import type {Inspectable, InspectableSection, Field} from '../inspectables'

export class BalanceInspector extends HTMLElement {
	private target: Inspectable | InspectableSection | null = null

	setTarget(target: Inspectable | InspectableSection | null) {
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

	/** The whole section as a sheet: one row per item, one column per tunable key. */
	private renderSheet(section: InspectableSection) {
		const columns: {key: string; label: string}[] = []
		for (const item of section.items) {
			for (const f of item.fields) {
				if (!columns.some((c) => c.key === f.key)) columns.push({key: f.key, label: f.label})
			}
		}
		render(
			this,
			() => html`
				<header class="BalanceInspector-header">
					<h3>${section.section}</h3>
				</header>
				<table class="BalanceInspector-sheet">
					<tr>
						<th></th>
						${columns.map((c) => html`<th title=${c.label}>${c.key}</th>`)}
					</tr>
					${section.items.map(
						(item) => html`
							<tr>
								<td>${item.title}</td>
								${columns.map((c) => {
									const f = item.fields.find((f) => f.key === c.key)
									return html`<td>${f ? this.renderCell(f) : ''}</td>`
								})}
							</tr>
						`,
					)}
				</table>
			`,
		)
	}

	private renderCell(f: Field) {
		if (f.kind === 'boolean') {
			return html`<input
				type="checkbox"
				.checked=${f.get()}
				onchange=${(e: Event) => {
					f.set((e.target as HTMLInputElement).checked)
				}}
			/>`
		}
		return html`<input
			type="number"
			step=${f.step ?? 1}
			min=${f.min ?? ''}
			.value=${String(f.get())}
			onchange=${(e: Event) => {
				const v = (e.target as HTMLInputElement).valueAsNumber
				if (Number.isFinite(v)) f.set(v)
			}}
		/>`
	}

	render() {
		const t = this.target
		if (!t) {
			render(this, () => html`<p class="BalanceInspector-empty">Select something to edit.</p>`)
			return
		}
		if ('items' in t) {
			this.renderSheet(t)
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
							<menu class="BalanceInspector-actions">
								${t.actions.map(
									(a) => html`
										<button
											class=${`Button BalanceInspector-action is-${a.variant ?? 'default'}`}
											onclick=${() => {
												a.run()
												this.render()
											}}
										>
											${a.label}
										</button>
									`,
								)}
							</menu>
						`
					: ''}
			`,
		)
	}
}

customElements.define('balance-inspector', BalanceInspector)
