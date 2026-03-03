/* eslint-disable @n8n/community-nodes/no-restricted-imports, @n8n/community-nodes/no-restricted-globals */
import 'dotenv/config';
import type { IDataObject, INode } from 'n8n-workflow';

const mockNode: INode = {
	id: 'integration-test-node',
	name: 'Notte',
	type: 'n8n-nodes-notte.notte',
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
};

function getApiKey(): string {
	const key = process.env.NOTTE_API_KEY;
	if (!key) {
		throw new Error('NOTTE_API_KEY is not set — cannot run integration tests');
	}
	return key;
}

export function createRealExecuteFunctions(overrides: {
	nodeParameters?: Record<string, unknown>;
} = {}) {
	const nodeParameters = overrides.nodeParameters ?? {};
	const apiKey = getApiKey();

	const credentials: IDataObject = {
		apiKey,
		baseUrl: 'https://api.notte.cc',
	};

	const context = {
		getNodeParameter: jest.fn((name: string, _index: number, fallback?: unknown) => {
			if (name in nodeParameters) {
				return nodeParameters[name];
			}
			return fallback;
		}),
		getCredentials: jest.fn().mockResolvedValue(credentials),
		getNode: jest.fn().mockReturnValue(mockNode),
		getInputData: jest.fn().mockReturnValue([{ json: {} }]),
		continueOnFail: jest.fn().mockReturnValue(false),
		helpers: {
			httpRequest: async (options: {
				method: string;
				url: string;
				headers?: Record<string, string>;
				body?: unknown;
				qs?: Record<string, string>;
			}) => {
				const url = new URL(options.url);
				if (options.qs) {
					for (const [key, value] of Object.entries(options.qs)) {
						url.searchParams.set(key, String(value));
					}
				}

				const response = await fetch(url.toString(), {
					method: options.method,
					headers: options.headers,
					body: options.body ? JSON.stringify(options.body) : undefined,
				});

				if (!response.ok) {
					const text = await response.text();
					throw new Error(`HTTP ${response.status}: ${text}`);
				}

				return response.json();
			},
		},
	};

	return { context };
}
