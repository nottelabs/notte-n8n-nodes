import type { IDataObject, INode } from 'n8n-workflow';

const mockNode: INode = {
	id: 'test-node-id',
	name: 'Notte',
	type: 'n8n-nodes-notte.notte',
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
};

const defaultCredentials: IDataObject = {
	apiKey: 'test-api-key-123',
	baseUrl: 'https://api.test.notte.cc',
};

export function createMockExecuteFunctions(overrides: {
	nodeParameters?: Record<string, unknown>;
	credentials?: IDataObject;
	continueOnFail?: boolean;
} = {}) {
	const nodeParameters = overrides.nodeParameters ?? {};
	const credentials = overrides.credentials ?? defaultCredentials;

	const mockHttpRequest = jest.fn();

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
		continueOnFail: jest.fn().mockReturnValue(overrides.continueOnFail ?? false),
		helpers: {
			httpRequest: mockHttpRequest,
		},
	};

	return { context, mockHttpRequest };
}

export function createMockPollFunctions(overrides: {
	nodeParameters?: Record<string, unknown>;
	credentials?: IDataObject;
	staticData?: IDataObject;
} = {}) {
	const nodeParameters = overrides.nodeParameters ?? {};
	const credentials = overrides.credentials ?? defaultCredentials;
	const staticData = overrides.staticData ?? {};

	const mockHttpRequest = jest.fn();

	const context = {
		getNodeParameter: jest.fn((name: string) => {
			return nodeParameters[name];
		}),
		getCredentials: jest.fn().mockResolvedValue(credentials),
		getNode: jest.fn().mockReturnValue(mockNode),
		getWorkflowStaticData: jest.fn().mockReturnValue(staticData),
		helpers: {
			httpRequest: mockHttpRequest,
		},
	};

	return { context, mockHttpRequest, staticData };
}
