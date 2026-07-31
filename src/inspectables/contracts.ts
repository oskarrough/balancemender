export type NumberField = {
	kind: 'number'
	key: string
	label: string
	get: () => number
	set: (value: number) => void
	step?: number
	min?: number
}

export type BooleanField = {
	kind: 'boolean'
	key: string
	label: string
	get: () => boolean
	set: (value: boolean) => void
}

export type Field = NumberField | BooleanField

export type Action = {
	label: string
	run: () => void
	variant?: 'danger' | 'primary' | 'default'
}

export type Inspectable = {
	id: string
	kind: 'ability' | 'effect' | 'cadence' | 'aura' | 'unit' | 'rule' | 'live' | 'globals'
	title: string
	subtitle?: string
	fields: Field[]
	actions?: Action[]
}

export type InspectableSection = {section: string; items: Inspectable[]}
