import { Notte } from '../../nodes/Notte/Notte.node';
import { createRealExecuteFunctions } from './helpers';

describe('Node integration: Scrape mode', () => {
	it(
		'should scrape a page via Notte.execute()',
		async () => {
			const { context } = createRealExecuteFunctions({
				nodeParameters: {
					mode: 'scrape',
					scrapeUrl: 'https://example.com',
					instructions: 'Extract the page title',
					scrapeResponseFormat: JSON.stringify({
						type: 'object',
						properties: {
							title: { type: 'string' },
						},
						required: ['title'],
					}),
					scrapeOptions: {},
				},
			});

			const node = new Notte();
			const result = await node.execute.call(context as never);

			expect(result[0]).toHaveLength(1);
			const json = result[0][0].json;
			expect(json.success).toBe(true);
			expect(json.markdown).toBeDefined();
			expect(json.structured).toBeDefined();
		},
		60_000,
	);
});
