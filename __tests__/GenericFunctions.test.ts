import {
	notteApiRequest,
	notteApiRequestWithPolling,
	notteApiRequestWithRedirect,
} from '../nodes/Notte/GenericFunctions';
import { createMockExecuteFunctions } from './helpers';

// Mock n8n-workflow's sleep to avoid real delays in tests
jest.mock('n8n-workflow', () => {
	const actual = jest.requireActual('n8n-workflow');
	return {
		...actual,
		sleep: jest.fn().mockResolvedValue(undefined),
	};
});

describe('notteApiRequest', () => {
	it('builds correct URL from credentials baseUrl + endpoint', async () => {
		const { context, mockHttpRequest } = createMockExecuteFunctions();
		mockHttpRequest.mockResolvedValue({ status: 'ok' });

		await notteApiRequest.call(context as never, 'GET', '/health');

		expect(mockHttpRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				url: 'https://api.test.notte.cc/health',
				method: 'GET',
			}),
		);
	});

	it('sets Authorization Bearer header from apiKey', async () => {
		const { context, mockHttpRequest } = createMockExecuteFunctions();
		mockHttpRequest.mockResolvedValue({});

		await notteApiRequest.call(context as never, 'GET', '/test');

		expect(mockHttpRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				headers: expect.objectContaining({
					Authorization: 'Bearer test-api-key-123',
				}),
			}),
		);
	});

	it('passes body when provided', async () => {
		const { context, mockHttpRequest } = createMockExecuteFunctions();
		mockHttpRequest.mockResolvedValue({});

		await notteApiRequest.call(context as never, 'POST', '/sessions', {
			headless: true,
		});

		expect(mockHttpRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				body: { headless: true },
			}),
		);
	});

	it('does not include body when empty', async () => {
		const { context, mockHttpRequest } = createMockExecuteFunctions();
		mockHttpRequest.mockResolvedValue({});

		await notteApiRequest.call(context as never, 'GET', '/test', {});

		const callArgs = mockHttpRequest.mock.calls[0][0];
		expect(callArgs.body).toBeUndefined();
	});

	it('passes query string params when provided', async () => {
		const { context, mockHttpRequest } = createMockExecuteFunctions();
		mockHttpRequest.mockResolvedValue({});

		await notteApiRequest.call(context as never, 'GET', '/test', undefined, {
			only_unread: true,
		});

		expect(mockHttpRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				qs: { only_unread: true },
			}),
		);
	});

	it('throws NodeOperationError on API failure with detail', async () => {
		const { context, mockHttpRequest } = createMockExecuteFunctions();
		mockHttpRequest.mockRejectedValue({
			response: { data: { error: 'Unauthorized' } },
		});

		await expect(
			notteApiRequest.call(context as never, 'GET', '/test'),
		).rejects.toThrow('Notte API error (/test)');
	});

	it('uses default baseUrl when credentials baseUrl is empty', async () => {
		const { context, mockHttpRequest } = createMockExecuteFunctions({
			credentials: { apiKey: 'key', baseUrl: '' },
		});
		mockHttpRequest.mockResolvedValue({});

		await notteApiRequest.call(context as never, 'GET', '/health');

		expect(mockHttpRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				url: 'https://api.notte.cc/health',
			}),
		);
	});

	it('merges extraHeaders into request headers', async () => {
		const { context, mockHttpRequest } = createMockExecuteFunctions();
		mockHttpRequest.mockResolvedValue({});

		await notteApiRequest.call(context as never, 'POST', '/test', {}, undefined, {
			'x-notte-api-key': 'extra-key',
		});

		expect(mockHttpRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				headers: expect.objectContaining({
					'x-notte-api-key': 'extra-key',
					Authorization: 'Bearer test-api-key-123',
				}),
			}),
		);
	});
});

describe('notteApiRequestWithRedirect', () => {
	it('makes request through n8n helper and returns body on success', async () => {
		const { context, mockHttpRequest } = createMockExecuteFunctions();
		mockHttpRequest.mockResolvedValueOnce({
			statusCode: 200,
			headers: {},
			body: { result: 'ok' },
		});

		const result = await notteApiRequestWithRedirect.call(
			context as never,
			'POST',
			'/functions/fn1/runs/start',
			{ workflow_id: 'fn1' },
			{ 'x-notte-api-key': 'test-key' },
		);

		expect(result).toEqual({ result: 'ok' });
		expect(mockHttpRequest).toHaveBeenCalledTimes(1);
		expect(mockHttpRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				url: 'https://api.test.notte.cc/functions/fn1/runs/start',
				method: 'POST',
				body: { workflow_id: 'fn1' },
				returnFullResponse: true,
				disableFollowRedirect: true,
				ignoreHttpStatusErrors: true,
				headers: expect.objectContaining({
					'x-notte-api-key': 'test-key',
					Authorization: 'Bearer test-api-key-123',
				}),
			}),
		);
	});

	it('follows redirect preserving headers via n8n helper', async () => {
		const { context, mockHttpRequest } = createMockExecuteFunctions();
		mockHttpRequest
			.mockResolvedValueOnce({
				statusCode: 307,
				headers: { location: 'https://lambda.example.com/run' },
				body: null,
			})
			.mockResolvedValueOnce({
				statusCode: 200,
				headers: {},
				body: { redirected: true },
			});

		const result = await notteApiRequestWithRedirect.call(
			context as never,
			'POST',
			'/functions/fn1/runs/start',
			{ workflow_id: 'fn1' },
		);

		expect(result).toEqual({ redirected: true });
		expect(mockHttpRequest).toHaveBeenCalledTimes(2);
		expect(mockHttpRequest).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				url: 'https://lambda.example.com/run',
				disableFollowRedirect: false,
				headers: expect.objectContaining({
					Authorization: 'Bearer test-api-key-123',
				}),
			}),
		);
	});
});

describe('notteApiRequestWithPolling', () => {
	it('returns response when terminal status reached', async () => {
		const { context, mockHttpRequest } = createMockExecuteFunctions();
		mockHttpRequest.mockResolvedValue({ status: 'closed', answer: 'done' });

		const result = await notteApiRequestWithPolling.call(
			context as never,
			'GET',
			'/agents/123',
			'status',
			['closed', 'error'],
			100,
			5000,
		);

		expect(result).toEqual({ status: 'closed', answer: 'done' });
	});

	it('polls multiple times until terminal status', async () => {
		const { context, mockHttpRequest } = createMockExecuteFunctions();
		mockHttpRequest
			.mockResolvedValueOnce({ status: 'active' })
			.mockResolvedValueOnce({ status: 'active' })
			.mockResolvedValueOnce({ status: 'closed', answer: 'result' });

		const result = await notteApiRequestWithPolling.call(
			context as never,
			'GET',
			'/agents/123',
			'status',
			['closed', 'error'],
			10,
			5000,
		);

		expect(mockHttpRequest).toHaveBeenCalledTimes(3);
		expect(result).toEqual({ status: 'closed', answer: 'result' });
	});
});
