import { makeApiRequest } from './helpers';

const FUNCTION_ID = '9fb6d40e-c76a-4d44-a73a-aa7843f0f535';

describe('Function mode end-to-end', () => {
	it(
		'should execute a function run successfully',
		async () => {
			// POST /functions/{id}/runs/start requires both auth headers and workflow_id in body
			// The API returns a 307 redirect to Lambda; our helper follows it preserving headers
			const result = await makeApiRequest<{
				function_run_id: string;
				status: string;
			}>(
				'POST',
				`/functions/${FUNCTION_ID}/runs/start`,
				{
					variables: { url: 'https://notte.cc' },
					workflow_id: FUNCTION_ID,
				},
				undefined,
				'both',
			);

			expect(result.function_run_id).toBeDefined();
			expect(result.status).toBe('closed');
		},
		120_000,
	);
});
