import { Notte } from '../../nodes/Notte/Notte.node';
import { createRealExecuteFunctions } from './helpers';

describe('Node integration: Agent mode', () => {
	it(
		'should complete an agent task via Notte.execute()',
		async () => {
			const { context } = createRealExecuteFunctions({
				nodeParameters: {
					mode: 'agent',
					task: 'What is the title of this page?',
					url: 'https://example.com',
					agentOptions: { headless: true },
				},
			});

			const node = new Notte();
			const result = await node.execute.call(context as never);

			expect(result[0]).toHaveLength(1);
			const json = result[0][0].json;
			expect(json.success).toBe(true);
			expect(json.status).toBe('closed');
			expect(json.answer).toBeDefined();
		},
		120_000,
	);
});
