module.exports = {
	projects: [
		{
			displayName: 'unit',
			preset: 'ts-jest',
			testEnvironment: 'node',
			testMatch: ['**/__tests__/**/*.test.ts'],
			testPathIgnorePatterns: ['\\.smoke\\.test\\.ts$', '\\.integration\\.test\\.ts$'],
			moduleFileExtensions: ['ts', 'js', 'json'],
			modulePathIgnorePatterns: ['<rootDir>/dist/'],
		},
		{
			displayName: 'smoke',
			preset: 'ts-jest',
			testEnvironment: 'node',
			testMatch: ['**/__tests__/**/*.smoke.test.ts'],
			moduleFileExtensions: ['ts', 'js', 'json'],
			modulePathIgnorePatterns: ['<rootDir>/dist/'],
			testTimeout: 120_000,
		},
		{
			displayName: 'integration',
			preset: 'ts-jest',
			testEnvironment: 'node',
			testMatch: ['**/__tests__/**/*.integration.test.ts'],
			moduleFileExtensions: ['ts', 'js', 'json'],
			modulePathIgnorePatterns: ['<rootDir>/dist/'],
			testTimeout: 120_000,
		},
	],
};
