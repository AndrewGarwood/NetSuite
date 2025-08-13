module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	roots: ['<rootDir>/src', '<rootDir>/__tests__'],
	testMatch: [
		'**/__tests__/**/*.test.(ts|tsx|js)',
		'**/*.(test|spec).(ts|tsx|js)'
	],
	transform: {
        '^.+\\.(ts|tsx)$': 'ts-jest'
	},
	moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
	collectCoverageFrom: [
		'src/**/*.{ts,tsx}',
		'!src/**/*.d.ts',
	],
	// Settings to handle ES modules and complex dependencies
	testTimeout: 30000,
	verbose: true,
	// Transform ES modules in node_modules
	transformIgnorePatterns: [
		'node_modules/(?!(open|chalk|strip-ansi|ansi-regex|wrap-ansi|string-width|emoji-regex|is-fullwidth-code-point|cli-cursor|restore-cursor|onetime|mimic-fn|is-interactive|is-unicode-supported)/)'
	],
	// Mock common problematic modules
	moduleNameMapper: {
		'^open$': '<rootDir>/__tests__/__mocks__/open.js'
	}
};
