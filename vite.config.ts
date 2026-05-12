import {defineConfig} from 'vite-plus'

export default defineConfig({
	lint: {
		options: {
			typeAware: true,
			typeCheck: true,
		},
	},
	fmt: {
		bracketSpacing: false,
		printWidth: 120,
		semi: false,
		singleQuote: true,
		useTabs: true,
		ignorePatterns: [],
	},
})
