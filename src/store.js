import {createLocalPersister} from 'tinybase/persisters/persister-browser'
import {createStore} from 'tinybase'

const KEY = 'webhealer-data-v1'

const DEFAULT_VIEWS = {
	// combatlog: {position: JSON.stringify({x: 0, y: 0})},
	// devconsole: {position: JSON.stringify({x: 0, y: 0})},
}

const store = createStore()
const persister = createLocalPersister(store, KEY)

// Restore or set default data
const hasData = localStorage.getItem(KEY) !== null
if (hasData) {
	await persister.load()
} else {
	console.log('No existing data found, setting defaults')
	Object.entries(DEFAULT_VIEWS).forEach(([id, data]) => {
		store.setRow('floating-views', id, data)
	})
}

await persister.startAutoSave()

export {store, KEY}
