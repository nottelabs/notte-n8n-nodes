import { Notte } from '../../nodes/Notte/Notte.node';
import { createRealExecuteFunctions } from './helpers';

const FUNCTION_ID = '9fb6d40e-c76a-4d44-a73a-aa7843f0f535';

describe('Node integration: Function mode', () => {
	it(
		'should execute a function run via Notte.execute()',
		async () => {
			const { context } = createRealExecuteFunctions({
				nodeParameters: {
					mode: 'function',
					functionId: FUNCTION_ID,
					variables: {
						variableValues: [{ name: 'url', value: 'https://notte.cc' }],
					},
					functionOptions: { waitForCompletion: true, timeout: 120, pollInterval: 3 },
				},
			});

			const node = new Notte();
			const result = await node.execute.call(context as never);

			expect(result[0]).toHaveLength(1);
			const json = result[0][0].json;
			expect(json.success).toBe(true);
			expect(json.status).toBe('closed');
		},
		120_000,
	);
});
