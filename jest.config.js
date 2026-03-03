module.exports = {
	projects: [
		{
			displayName: 'unit',
			preset: 'ts-jest',
			testEnvironment: 'node',
			testMatch: ['**/__tests__/**/*.test.ts'],
			testPathIgnorePatterns: ['\\.integration\\.test\\.ts$'],
			moduleFileExtensions: ['ts', 'js', 'json'],
			modulePathIgnorePatterns: ['<rootDir>/dist/'],
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
