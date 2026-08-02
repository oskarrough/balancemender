import {createStore} from 'tinybase'

const KEY = 'balancemender-data-v1'
const store = createStore()

// Node imports the in-memory store. Browsers hydrate it before dependent components are defined,
// then keep every table under the same local key.
try {
	if (typeof globalThis.localStorage !== 'undefined') {
		const {createLocalPersister} = await import('tinybase/persisters/persister-browser')
		const persister = createLocalPersister(store, KEY)
		await persister.load()
		await persister.startAutoSave()
	}
} catch (error) {
	console.warn('Local persistence is unavailable; changes will last for this page only', error)
}

export {store}
