import { makeApiRequest } from './helpers';

describe('Scrape mode end-to-end', () => {
	it(
		'should scrape a page with structured output',
		async () => {
			const result = await makeApiRequest<{
				markdown: string;
				structured: { success: boolean; data: { title: string } };
			}>('POST', '/scrape', {
				url: 'https://example.com',
				instructions: 'Extract the page title',
				response_format: {
					type: 'object',
					properties: {
						title: { type: 'string' },
					},
					required: ['title'],
				},
			});

			expect(typeof result.markdown).toBe('string');
			expect(result.markdown.length).toBeGreaterThan(0);
			expect(result.structured).toBeDefined();
			expect(result.structured.success).toBe(true);
			expect(typeof result.structured.data.title).toBe('string');
		},
		60_000,
	);
});
