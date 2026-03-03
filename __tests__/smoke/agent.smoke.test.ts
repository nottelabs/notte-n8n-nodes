import { makeApiRequest, pollUntilDone } from './helpers';

describe('Agent mode end-to-end', () => {
	let sessionId: string;

	afterAll(async () => {
		if (sessionId) {
			try {
				await makeApiRequest('DELETE', `/sessions/${sessionId}/stop`);
			} catch {
				// best-effort cleanup
			}
		}
	});

	it(
		'should complete an agent task successfully',
		async () => {
			// 1. Create a session (POST /sessions/start requires a body)
			const session = await makeApiRequest<{ session_id: string }>(
				'POST',
				'/sessions/start',
				{},
			);
			sessionId = session.session_id;
			expect(sessionId).toBeDefined();

			// 2. Start agent
			const agentResponse = await makeApiRequest<{ agent_id: string }>(
				'POST',
				'/agents/start',
				{
					task: 'What is the title of this page?',
					session_id: sessionId,
					url: 'https://example.com',
				},
			);
			const agentId = agentResponse.agent_id;
			expect(agentId).toBeDefined();

			// 3. Poll until terminal status
			const result = await pollUntilDone<{
				status: string;
				success: boolean;
				answer: string;
			}>(`/agents/${agentId}`);

			// 4. Assert
			expect(result.status).toBe('closed');
			expect(result.success).toBe(true);
			expect(result.answer).toBeDefined();
		},
		120_000,
	);
});
