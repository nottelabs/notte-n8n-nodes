import type { INodeProperties } from 'n8n-workflow';

export const scrapeFields: INodeProperties[] = [
	{
		displayName: 'URL',
		name: 'scrapeUrl',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. https://example.com/pricing',
		description: 'The URL to scrape',
		displayOptions: {
			show: {
				mode: ['scrape'],
			},
		},
	},
	{
		displayName: 'Instructions',
		name: 'instructions',
		type: 'string',
		typeOptions: { rows: 3 },
		default: '',
		placeholder: 'e.g. Extract all product names and prices from this page',
		description: 'What data to extract from the page',
		displayOptions: {
			show: {
				mode: ['scrape'],
			},
		},
	},
	{
		displayName: 'Response Format',
		name: 'scrapeResponseFormat',
		type: 'json',
		default: '',
		placeholder:
			'{"type": "object", "properties": {"items": {"type": "array", "items": {"type": "object", "properties": {"name": {"type": "string"}, "price": {"type": "string"}}}}}}',
		description: 'JSON schema defining the structure of the output data',
		displayOptions: {
			show: {
				mode: ['scrape'],
			},
		},
	},
	{
		displayName: 'Options',
		name: 'scrapeOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				mode: ['scrape'],
			},
		},
		options: [
			{
				displayName: 'Headless',
				name: 'headless',
				type: 'boolean',
				default: true,
				description: 'Whether to run the browser in headless mode',
			},
			{
				displayName: 'Only Main Content',
				name: 'onlyMainContent',
				type: 'boolean',
				default: true,
				description: 'Whether to extract only the main content of the page',
			},
			{
				displayName: 'Proxy',
				name: 'proxy',
				type: 'boolean',
				default: false,
				description: 'Whether to route traffic through a proxy',
			},
			{
				displayName: 'Scrape Images',
				name: 'scrapeImages',
				type: 'boolean',
				default: false,
				description: 'Whether to include images in the scrape results',
			},
			{
				displayName: 'Scrape Links',
				name: 'scrapeLinks',
				type: 'boolean',
				default: true,
				description: 'Whether to include links in the scrape results',
			},
			{
				displayName: 'Selector',
				name: 'selector',
				type: 'string',
				default: '',
				placeholder: 'e.g. .main-content',
				description: 'CSS selector to scope the scrape to a specific part of the page',
			},
			{
				displayName: 'Solve Captchas',
				name: 'solveCaptchas',
				type: 'boolean',
				default: false,
				description: 'Whether to automatically solve captchas',
			},
		],
	},
];
