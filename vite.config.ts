import {defineConfig} from 'vite-plus'

export default defineConfig({
	test: {
		// Silences the combat logger — see the file. Without it a failing test arrives buried in
		// pino output.
		setupFiles: ['./src/test-setup.ts'],
	},
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
