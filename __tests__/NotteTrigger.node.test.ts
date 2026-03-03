import { NotteTrigger } from '../nodes/Notte/NotteTrigger.node';
import { createMockPollFunctions } from './helpers';

// Mock n8n-workflow's sleep
jest.mock('n8n-workflow', () => {
	const actual = jest.requireActual('n8n-workflow');
	return {
		...actual,
		sleep: jest.fn().mockResolvedValue(undefined),
	};
});

describe('NotteTrigger Node', () => {
	describe('description', () => {
		it('has correct metadata', () => {
			const node = new NotteTrigger();
			expect(node.description.displayName).toBe('Notte Trigger');
			expect(node.description.name).toBe('notteTrigger');
			expect(node.description.polling).toBe(true);
			expect(node.description.usableAsTool).toBe(true);
		});
	});

	describe('poll - newEmail', () => {
		it('calls correct endpoint for email event', async () => {
			const { context, mockHttpRequest } = createMockPollFunctions({
				nodeParameters: {
					event: 'newEmail',
					personaId: 'per_abc',
				},
			});

			mockHttpRequest.mockResolvedValue([
				{
					email_id: 'em_1',
					subject: 'Welcome',
					created_at: '2026-01-01T00:00:00Z',
				},
			]);

			const node = new NotteTrigger();
			await node.poll.call(context as never);

			expect(mockHttpRequest).toHaveBeenCalledWith(
				expect.objectContaining({
					url: 'https://api.test.notte.cc/personas/per_abc/emails',
				}),
			);
		});

		it('returns null when no new messages', async () => {
			const { context, mockHttpRequest } = createMockPollFunctions({
				nodeParameters: {
					event: 'newEmail',
					personaId: 'per_abc',
				},
			});

			mockHttpRequest.mockResolvedValue([]);

			const node = new NotteTrigger();
			const result = await node.poll.call(context as never);

			expect(result).toBeNull();
		});

		it('filters out already-seen messages', async () => {
			const staticData = { lastSeen: '2026-01-01T10:00:00Z' };
			const { context, mockHttpRequest } = createMockPollFunctions({
				nodeParameters: {
					event: 'newEmail',
					personaId: 'per_abc',
				},
				staticData,
			});

			mockHttpRequest.mockResolvedValue([
				{ email_id: 'em_old', subject: 'Old', created_at: '2026-01-01T09:00:00Z' },
				{ email_id: 'em_new', subject: 'New', created_at: '2026-01-01T11:00:00Z' },
			]);

			const node = new NotteTrigger();
			const result = await node.poll.call(context as never);

			expect(result).not.toBeNull();
			expect(result![0]).toHaveLength(1);
			expect(result![0][0].json.id).toBe('em_new');
		});

		it('updates staticData.lastSeen to most recent timestamp', async () => {
			const staticData = {};
			const { context, mockHttpRequest } = createMockPollFunctions({
				nodeParameters: {
					event: 'newEmail',
					personaId: 'per_abc',
				},
				staticData,
			});

			mockHttpRequest.mockResolvedValue([
				{ email_id: 'em_1', subject: 'First', created_at: '2026-01-01T08:00:00Z' },
				{ email_id: 'em_2', subject: 'Second', created_at: '2026-01-01T12:00:00Z' },
				{ email_id: 'em_3', subject: 'Third', created_at: '2026-01-01T10:00:00Z' },
			]);

			const node = new NotteTrigger();
			await node.poll.call(context as never);

			expect(staticData).toHaveProperty('lastSeen', '2026-01-01T12:00:00Z');
		});
	});

	describe('poll - newSms', () => {
		it('calls correct endpoint for SMS event', async () => {
			const { context, mockHttpRequest } = createMockPollFunctions({
				nodeParameters: {
					event: 'newSms',
					personaId: 'per_xyz',
				},
			});

			mockHttpRequest.mockResolvedValue([
				{
					sms_id: 'sms_1',
					body: 'Your code is 123456',
					created_at: '2026-01-01T00:00:00Z',
				},
			]);

			const node = new NotteTrigger();
			const result = await node.poll.call(context as never);

			expect(mockHttpRequest).toHaveBeenCalledWith(
				expect.objectContaining({
					url: 'https://api.test.notte.cc/personas/per_xyz/sms',
				}),
			);

			expect(result).not.toBeNull();
			expect(result![0][0].json).toMatchObject({
				sms_id: 'sms_1',
				id: 'sms_1',
				persona_id: 'per_xyz',
				event_type: 'newSms',
			});
		});
	});
});
