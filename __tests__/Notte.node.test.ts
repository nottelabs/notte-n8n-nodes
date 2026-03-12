/* eslint-disable @n8n/community-nodes/no-restricted-globals */
import { Notte } from '../nodes/Notte/Notte.node';
import { createMockExecuteFunctions } from './helpers';

// Mock n8n-workflow's sleep
jest.mock('n8n-workflow', () => {
	const actual = jest.requireActual('n8n-workflow');
	return {
		...actual,
		sleep: jest.fn().mockResolvedValue(undefined),
	};
});

describe('Notte Node', () => {
		describe('description', () => {
			it('has correct metadata', () => {
				const node = new Notte();
				expect(node.description.displayName).toBe('Notte Agent Browser');
				expect(node.description.name).toBe('notte');
				expect(node.description.usableAsTool).toBe(true);
			});
		});

	describe('Agent mode', () => {
		it('creates session, starts agent, polls, and returns result', async () => {
			const { context, mockHttpRequest } = createMockExecuteFunctions({
				nodeParameters: {
					mode: 'agent',
					task: 'Extract pricing info',
					url: 'https://example.com',
					agentOptions: { headless: true },
				},
			});

			// Session start
			mockHttpRequest.mockResolvedValueOnce({ session_id: 'ses_123' });
			// Agent start
			mockHttpRequest.mockResolvedValueOnce({ agent_id: 'agt_456' });
			// Agent status (polling) - terminal
			mockHttpRequest.mockResolvedValueOnce({
				status: 'closed',
				success: true,
				answer: 'Found pricing',
				steps: [{ action: 'navigate' }],
				task: 'Extract pricing info',
			});
			// Session cleanup
			mockHttpRequest.mockResolvedValueOnce({});

			const node = new Notte();
			const result = await node.execute.call(context as never);

			expect(result[0]).toHaveLength(1);
			expect(result[0][0].json).toMatchObject({
				success: true,
				answer: 'Found pricing',
				agent_id: 'agt_456',
				session_id: 'ses_123',
				status: 'closed',
			});

			// Verify correct URLs
			expect(mockHttpRequest.mock.calls[0][0].url).toContain('/sessions/start');
			expect(mockHttpRequest.mock.calls[3][0].url).toContain('/sessions/ses_123/stop');
		});

		it('prepends https:// to URL without protocol', async () => {
			const { context, mockHttpRequest } = createMockExecuteFunctions({
				nodeParameters: {
					mode: 'agent',
					task: 'Test',
					url: 'example.com',
					agentOptions: {},
				},
			});

			mockHttpRequest.mockResolvedValueOnce({ session_id: 'ses_1' });
			mockHttpRequest.mockResolvedValueOnce({ agent_id: 'agt_1' });
			mockHttpRequest.mockResolvedValueOnce({ status: 'closed', success: true });
			mockHttpRequest.mockResolvedValueOnce({});

			const node = new Notte();
			await node.execute.call(context as never);

			// The agent start call (2nd call) should have https:// prepended
			const agentStartBody = mockHttpRequest.mock.calls[1][0].body;
			expect(agentStartBody.url).toBe('https://example.com');
		});

		it('passes optional agent params', async () => {
			const { context, mockHttpRequest } = createMockExecuteFunctions({
				nodeParameters: {
					mode: 'agent',
					task: 'Login and scrape',
					url: '',
					agentOptions: {
						maxSteps: 20,
						vaultId: 'vlt_abc',
						personaId: 'per_def',
						useVision: false,
						reasoningModel: 'gpt-4o',
						proxy: true,
					},
				},
			});

			mockHttpRequest.mockResolvedValueOnce({ session_id: 'ses_1' });
			mockHttpRequest.mockResolvedValueOnce({ agent_id: 'agt_1' });
			mockHttpRequest.mockResolvedValueOnce({ status: 'closed', success: true });
			mockHttpRequest.mockResolvedValueOnce({});

			const node = new Notte();
			await node.execute.call(context as never);

			// Session start should have proxies
			const sessionBody = mockHttpRequest.mock.calls[0][0].body;
			expect(sessionBody.proxies).toBe(true);

			// Agent start should have all optional params
			const agentBody = mockHttpRequest.mock.calls[1][0].body;
			expect(agentBody.max_steps).toBe(20);
			expect(agentBody.vault_id).toBe('vlt_abc');
			expect(agentBody.persona_id).toBe('per_def');
			expect(agentBody.use_vision).toBe(false);
			expect(agentBody.reasoning_model).toBe('gpt-4o');
		});

		it('cleans up session on agent error', async () => {
			const { context, mockHttpRequest } = createMockExecuteFunctions({
				nodeParameters: {
					mode: 'agent',
					task: 'Fail task',
					url: '',
					agentOptions: {},
				},
			});

			mockHttpRequest.mockResolvedValueOnce({ session_id: 'ses_1' });
			mockHttpRequest.mockRejectedValueOnce({ message: 'Agent start failed' });
			// Cleanup calls
			mockHttpRequest.mockResolvedValueOnce({});

			const node = new Notte();
			await expect(node.execute.call(context as never)).rejects.toThrow();

			// Should have attempted session cleanup (DELETE /sessions/ses_1)
			const cleanupCalls = mockHttpRequest.mock.calls.filter(
				(call) => call[0].method === 'DELETE',
			);
			expect(cleanupCalls.length).toBeGreaterThan(0);
		});

		it('parses responseFormat JSON string', async () => {
			const { context, mockHttpRequest } = createMockExecuteFunctions({
				nodeParameters: {
					mode: 'agent',
					task: 'Extract data',
					url: '',
					agentOptions: {
						responseFormat: '{"type": "object", "properties": {"name": {"type": "string"}}}',
					},
				},
			});

			mockHttpRequest.mockResolvedValueOnce({ session_id: 'ses_1' });
			mockHttpRequest.mockResolvedValueOnce({ agent_id: 'agt_1' });
			mockHttpRequest.mockResolvedValueOnce({ status: 'closed', success: true });
			mockHttpRequest.mockResolvedValueOnce({});

			const node = new Notte();
			await node.execute.call(context as never);

			const agentBody = mockHttpRequest.mock.calls[1][0].body;
			expect(agentBody.response_format).toEqual({
				type: 'object',
				properties: { name: { type: 'string' } },
			});
		});
	});

	describe('Scrape mode', () => {
		it('sends correct body to POST /scrape', async () => {
			const { context, mockHttpRequest } = createMockExecuteFunctions({
				nodeParameters: {
					mode: 'scrape',
					scrapeUrl: 'https://example.com/pricing',
					instructions: 'Extract plan names and prices',
					scrapeResponseFormat: '{"type": "object"}',
					scrapeOptions: {},
				},
			});

			mockHttpRequest.mockResolvedValueOnce({
				markdown: '# Pricing',
				structured: { plans: [] },
			});

			const node = new Notte();
			const result = await node.execute.call(context as never);

			expect(mockHttpRequest).toHaveBeenCalledWith(
				expect.objectContaining({
					url: 'https://api.test.notte.cc/scrape',
					method: 'POST',
				}),
			);

			const body = mockHttpRequest.mock.calls[0][0].body;
			expect(body.url).toBe('https://example.com/pricing');
			expect(body.instructions).toBe('Extract plan names and prices');
			expect(body.response_format).toEqual({ type: 'object' });

			expect(result[0][0].json).toMatchObject({
				success: true,
				markdown: '# Pricing',
				structured: { plans: [] },
			});
		});

		it('throws on invalid responseFormat JSON', async () => {
			const { context } = createMockExecuteFunctions({
				nodeParameters: {
					mode: 'scrape',
					scrapeUrl: 'https://example.com',
					instructions: 'Extract data',
					scrapeResponseFormat: 'not valid json',
					scrapeOptions: {},
				},
			});

			const node = new Notte();
			await expect(node.execute.call(context as never)).rejects.toThrow(
				'Response Format must be valid JSON',
			);
		});

		it('applies optional scrape params', async () => {
			const { context, mockHttpRequest } = createMockExecuteFunctions({
				nodeParameters: {
					mode: 'scrape',
					scrapeUrl: 'https://example.com',
					instructions: 'Extract data',
					scrapeResponseFormat: '{"type": "object"}',
					scrapeOptions: {
						selector: '.main-content',
						proxy: true,
						scrapeImages: true,
					},
				},
			});

			mockHttpRequest.mockResolvedValueOnce({ markdown: '', structured: {} });

			const node = new Notte();
			await node.execute.call(context as never);

			const body = mockHttpRequest.mock.calls[0][0].body;
			expect(body.selector).toBe('.main-content');
			expect(body.proxies).toBe(true);
			expect(body.scrape_images).toBe(true);
		});

		it('omits optional instructions and response format when empty', async () => {
			const { context, mockHttpRequest } = createMockExecuteFunctions({
				nodeParameters: {
					mode: 'scrape',
					scrapeUrl: 'https://example.com',
					instructions: '',
					scrapeResponseFormat: '',
					scrapeOptions: {},
				},
			});

			mockHttpRequest.mockResolvedValueOnce({ markdown: '', structured: {} });

			const node = new Notte();
			await node.execute.call(context as never);

			const body = mockHttpRequest.mock.calls[0][0].body;
			expect(body).not.toHaveProperty('instructions');
			expect(body).not.toHaveProperty('response_format');
		});
	});

	describe('Function mode', () => {
		let mockFetch: jest.SpyInstance;

		afterEach(() => {
			if (mockFetch) {
				mockFetch.mockRestore();
			}
		});

		it('starts function run and polls until closed', async () => {
			const { context, mockHttpRequest } = createMockExecuteFunctions({
				nodeParameters: {
					mode: 'function',
					functionId: 'fn_abc123',
					variables: {
						variableValues: [{ name: 'target_url', value: 'https://example.com' }],
					},
					functionOptions: { waitForCompletion: true, timeout: 60, pollInterval: 1 },
				},
			});

			// Mock fetch for the start call (uses notteApiRequestWithRedirect)
			mockFetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({ function_run_id: 'run_789' }),
				headers: new Headers(),
			} as Response);

			// Poll status - terminal (uses notteApiRequestWithPolling → httpRequest)
			mockHttpRequest.mockResolvedValueOnce({
				status: 'closed',
				result: 'All done',
				logs: ['step 1', 'step 2'],
			});

			const node = new Notte();
			const result = await node.execute.call(context as never);

			// Check fetch was called with correct URL and body
			expect(mockFetch).toHaveBeenCalledTimes(1);
			const [fetchUrl, fetchOptions] = mockFetch.mock.calls[0];
			expect(fetchUrl).toContain('/functions/fn_abc123/runs/start');
			const fetchBody = JSON.parse(fetchOptions.body);
			expect(fetchBody.workflow_id).toBe('fn_abc123');
			expect(fetchBody.variables).toEqual({ target_url: 'https://example.com' });
			expect(fetchOptions.headers['x-notte-api-key']).toBe('test-api-key-123');

			expect(result[0][0].json).toMatchObject({
				success: true,
				function_id: 'fn_abc123',
				function_run_id: 'run_789',
				status: 'closed',
				result: 'All done',
			});
		});

		it('returns immediately when waitForCompletion is false', async () => {
			const { context } = createMockExecuteFunctions({
				nodeParameters: {
					mode: 'function',
					functionId: 'fn_abc123',
					variables: {},
					functionOptions: { waitForCompletion: false },
				},
			});

			// Mock fetch for the start call
			mockFetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({ function_run_id: 'run_789' }),
				headers: new Headers(),
			} as Response);

			const node = new Notte();
			const result = await node.execute.call(context as never);

			// Should only have called fetch (start), not httpRequest (poll)
			expect(mockFetch).toHaveBeenCalledTimes(1);
			expect(result[0][0].json).toMatchObject({
				success: true,
				status: 'started',
				function_run_id: 'run_789',
			});
		});
	});

	describe('Error handling', () => {
		it('continueOnFail returns error object instead of throwing', async () => {
			const { context, mockHttpRequest } = createMockExecuteFunctions({
				nodeParameters: {
					mode: 'agent',
					task: 'Fail',
					url: '',
					agentOptions: {},
				},
				continueOnFail: true,
			});

			mockHttpRequest.mockRejectedValue({ message: 'API down' });

			const node = new Notte();
			const result = await node.execute.call(context as never);

			expect(result[0][0].json).toMatchObject({
				success: false,
			});
			expect(result[0][0].json.error).toBeDefined();
		});
	});
});
