export default {
	testEnvironment: 'node',
	testMatch: [
		'<rootDir>/testing/tests/**/*.test.ts',
	],
	moduleNameMapper: {
		'^@lib$': '<rootDir>/lib/esm/index.js',
		'^@src/(.*)$': '<rootDir>/src/$1',
		'^@archive/(.*)$': '<rootDir>/archive/$1',
		'^@testing/(.*)$': '<rootDir>/testing/$1',
	},
	passWithNoTests: true,
	moduleFileExtensions: ['mts', 'cts', 'ts', 'mjs', 'cjs', 'js', 'json'],
	extensionsToTreatAsEsm: ['.mts', '.ts'],
	transform: {
		'^.+\\.mts$': ['ts-jest', { useESM: true }],
		'^.+\\.ts$': ['ts-jest', { useESM: true }],
		'^.+\\.cts$': 'ts-jest',
	},
};
