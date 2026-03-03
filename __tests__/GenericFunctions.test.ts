import { notteApiRequest, notteApiRequestWithPolling } from '../nodes/Notte/GenericFunctions';
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

	it('throws on timeout', async () => {
		const { context, mockHttpRequest } = createMockExecuteFunctions();
		mockHttpRequest.mockResolvedValue({ status: 'active' });

		// Use a very short timeout so it triggers immediately
		jest.spyOn(Date, 'now')
			.mockReturnValueOnce(0) // startTime
			.mockReturnValueOnce(0) // first while check
			.mockReturnValueOnce(10000); // second while check - exceeds timeout

		await expect(
			notteApiRequestWithPolling.call(
				context as never,
				'GET',
				'/agents/123',
				'status',
				['closed'],
				10,
				100, // 0.1s timeout
			),
		).rejects.toThrow('Polling timed out');

		jest.restoreAllMocks();
	});
});
