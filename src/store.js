import {createLocalPersister} from 'tinybase/persisters/persister-browser'
import {createStore} from 'tinybase'

const KEY = 'webhealer-data-v1'

const DEFAULT_VIEWS = {
	combatlog: {position: JSON.stringify({x: 0, y: 0})},
	devconsole: {position: JSON.stringify({x: 0, y: 0})},
}

const store = createStore()
const persister = createLocalPersister(store, KEY)

const hasData = localStorage.getItem(KEY) !== null
if (hasData) {
	await persister.load()
	console.log('Data loaded from localStorage')
} else {
	Object.entries(DEFAULT_VIEWS).forEach(([id, data]) => {
		store.setRow('floating-views', id, data)
	})

	console.log('No existing data found, using defaults')
}

await persister.startAutoSave()
console.log('Auto-save enabled')

export {store, persister, KEY}
