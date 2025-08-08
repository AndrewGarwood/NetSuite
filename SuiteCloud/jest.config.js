const SuiteCloudJestConfiguration = require("@oracle/suitecloud-unit-testing/jest-configuration/SuiteCloudJestConfiguration");
const cliConfig = require("./suitecloud.config");

const baseConfig = SuiteCloudJestConfiguration.build({
	projectFolder: cliConfig.defaultProjectFolder,
	projectType: SuiteCloudJestConfiguration.ProjectType.ACP,
});

module.exports = {
	...baseConfig,
	preset: 'ts-jest',
	testEnvironment: 'node',
	roots: ['<rootDir>/src', '<rootDir>/__tests__'],
	testMatch: [
		'**/__tests__/**/*.test.(ts|tsx|js)',
		'**/*.(test|spec).(ts|tsx|js)'
	],
	transform: {
		'^.+\\.(ts|tsx)$': 'ts-jest',
		'^.+\\.(js|jsx)$': 'babel-jest',
	},
	moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
	moduleNameMapper: {
		'^@utils/(.*)$': '<rootDir>/src/utils/$1',
		'^@api/(.*)$': '<rootDir>/src/api/$1',
		'^@config/(.*)$': '<rootDir>/src/config/$1',
		'^src/(.*)$': '<rootDir>/src/$1',
	},
	transformIgnorePatterns: [
		'node_modules/(?!(open|.*\\.mjs$))'
	],
	collectCoverageFrom: [
		'src/**/*.{ts,tsx}',
		'!src/**/*.d.ts',
	],
	// Add settings to handle async operations
	testTimeout: 10000,
	forceExit: true,
	detectOpenHandles: true,
	maxWorkers: 1
};
