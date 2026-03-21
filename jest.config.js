export default {
	testEnvironment: 'node',
	testMatch: [
		'<rootDir>/test/**/*.test.mts',
	],
	passWithNoTests: true,
	moduleFileExtensions: ['mts', 'cts', 'ts', 'mjs', 'cjs', 'js', 'json'],
	extensionsToTreatAsEsm: ['.mts', '.ts'],
	transform: {
		'^.+\\.mts$': ['ts-jest', { useESM: true }],
		'^.+\\.ts$': ['ts-jest', { useESM: true }],
		'^.+\\.cts$': 'ts-jest',
	},
};
