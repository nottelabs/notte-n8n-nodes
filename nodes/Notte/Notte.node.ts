import {
	NodeConnectionTypes,
	type IDataObject,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import {
	notteApiRequest,
	notteApiRequestWithPolling,
	notteApiRequestWithRedirect,
} from './GenericFunctions';
import { agentFields } from './descriptions/AgentDescription';
import { scrapeFields } from './descriptions/ScrapeDescription';
import { functionFields } from './descriptions/FunctionDescription';

export class Notte implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Notte Agent Browser',
		name: 'notte',
		icon: 'file:../../icons/notte.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{ "Mode: " + $parameter["mode"] }}',
		description:
			'AI-powered browser automation for autonomous web tasks, scraping, and workflows with Notte',
		defaults: {
			name: 'Notte Agent Browser',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'notteApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Mode',
				name: 'mode',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Agent',
						value: 'agent',
						description: 'Run an AI agent to perform browser tasks autonomously',
					},
					{
						name: 'Scrape',
						value: 'scrape',
						description: 'Extract structured data from a URL',
					},
					{
						name: 'Function',
						value: 'function',
						description:
							'Run a deployed Notte function (author via CLI, execute here)',
					},
				],
				default: 'agent',
			},
			...agentFields,
			...scrapeFields,
			...functionFields,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const mode = this.getNodeParameter('mode', i) as string;

				let result: IDataObject;

				if (mode === 'agent') {
					result = await executeAgent.call(this, i);
				} else if (mode === 'scrape') {
					result = await executeScrape.call(this, i);
				} else if (mode === 'function') {
					result = await executeFunction.call(this, i);
				} else {
					throw new NodeOperationError(this.getNode(), `Unknown mode: ${mode}`);
				}

				returnData.push({
					json: result,
					pairedItem: { item: i },
				});
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							success: false,
							error: error instanceof Error ? error.message : String(error),
						},
						pairedItem: { item: i },
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}

// ── Agent Mode ──────────────────────────────────────────────────────────────────

async function executeAgent(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<IDataObject> {
	const task = this.getNodeParameter('task', itemIndex) as string;
	let url = this.getNodeParameter('url', itemIndex, '') as string;
	const options = this.getNodeParameter('agentOptions', itemIndex, {}) as {
		headless?: boolean;
		maxSteps?: number;
		personaId?: string;
		proxy?: boolean;
		reasoningModel?: string;
		responseFormat?: string;
		solveCaptchas?: boolean;
		useVision?: boolean;
		vaultId?: string;
	};

	if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
		url = `https://${url}`;
	}

	// 1. Start a session
	const sessionBody: IDataObject = {
		headless: options.headless ?? true,
		solve_captchas: options.solveCaptchas ?? false,
	};

	if (options.proxy) {
		sessionBody.proxies = true;
	}

	const sessionResponse = (await notteApiRequest.call(
		this,
		'POST',
		'/sessions/start',
		sessionBody,
	)) as IDataObject;

	const sessionId = sessionResponse.session_id as string;
	if (!sessionId) {
		throw new NodeOperationError(
			this.getNode(),
			'Failed to get session_id from session start response',
		);
	}

	let agentId: string | undefined;

	try {
		// 2. Start the agent
		const agentBody: IDataObject = {
			task,
			session_id: sessionId,
		};

		if (url) {
			agentBody.url = url;
		}
		if (options.maxSteps) {
			agentBody.max_steps = options.maxSteps;
		}
		if (options.useVision !== undefined) {
			agentBody.use_vision = options.useVision;
		}
		if (options.reasoningModel) {
			agentBody.reasoning_model = options.reasoningModel;
		}
		if (options.vaultId) {
			agentBody.vault_id = options.vaultId;
		}
		if (options.personaId) {
			agentBody.persona_id = options.personaId;
		}
		if (options.responseFormat) {
			try {
				agentBody.response_format = JSON.parse(options.responseFormat);
			} catch {
				agentBody.response_format = options.responseFormat;
			}
		}

		const agentResponse = (await notteApiRequest.call(
			this,
			'POST',
			'/agents/start',
			agentBody,
		)) as IDataObject;

		agentId = agentResponse.agent_id as string;
		if (!agentId) {
			throw new NodeOperationError(
				this.getNode(),
				'Failed to get agent_id from agent start response',
			);
		}

		// 3. Poll until agent completes
		const finalStatus = (await notteApiRequestWithPolling.call(
			this,
			'GET',
			`/agents/${agentId}`,
			'status',
			['closed', 'error', 'failed'],
			2000,
			300000,
		)) as IDataObject;

		// 4. Stop the session
		try {
			await notteApiRequest.call(this, 'DELETE', `/sessions/${sessionId}/stop`);
		} catch {
			// Ignore cleanup errors
		}

		return {
			success: finalStatus.success ?? false,
			answer: finalStatus.answer ?? null,
			task: finalStatus.task ?? task,
			steps: finalStatus.steps ?? [],
			agent_id: agentId,
			session_id: sessionId,
			status: finalStatus.status,
		};
	} catch (error) {
		// Cleanup: stop agent and session on error
		if (agentId) {
			try {
				await notteApiRequest.call(
					this,
					'DELETE',
					`/agents/${agentId}/stop`,
					undefined,
					{ session_id: sessionId },
				);
			} catch {
				// Ignore cleanup errors
			}
		}
		try {
			await notteApiRequest.call(this, 'DELETE', `/sessions/${sessionId}/stop`);
		} catch {
			// Ignore cleanup errors
		}
		throw error;
	}
}

// ── Scrape Mode ─────────────────────────────────────────────────────────────────

async function executeScrape(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<IDataObject> {
	let url = this.getNodeParameter('scrapeUrl', itemIndex) as string;
	const instructions = this.getNodeParameter('instructions', itemIndex) as string;
	const responseFormatRaw = this.getNodeParameter('scrapeResponseFormat', itemIndex) as string;
	const options = this.getNodeParameter('scrapeOptions', itemIndex, {}) as {
		headless?: boolean;
		onlyMainContent?: boolean;
		proxy?: boolean;
		scrapeImages?: boolean;
		scrapeLinks?: boolean;
		selector?: string;
		solveCaptchas?: boolean;
	};

	if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
		url = `https://${url}`;
	}

	let responseFormat: IDataObject | undefined;
	if (responseFormatRaw.trim()) {
		try {
			responseFormat = JSON.parse(responseFormatRaw) as IDataObject;
		} catch {
			throw new NodeOperationError(
				this.getNode(),
				'Response Format must be valid JSON (a JSON schema)',
			);
		}
	}

	const body: IDataObject = {
		url,
		headless: options.headless ?? true,
		only_main_content: options.onlyMainContent ?? true,
		scrape_links: options.scrapeLinks ?? true,
		scrape_images: options.scrapeImages ?? false,
		solve_captchas: options.solveCaptchas ?? false,
	};

	if (instructions.trim()) {
		body.instructions = instructions;
	}
	if (responseFormat) {
		body.response_format = responseFormat;
	}

	if (options.proxy) {
		body.proxies = true;
	}
	if (options.selector) {
		body.selector = options.selector;
	}

	const response = (await notteApiRequest.call(this, 'POST', '/scrape', body)) as Record<
		string,
		unknown
	>;

	return {
		success: true,
		markdown: response.markdown ?? null,
		structured: response.structured ?? null,
		images: response.images ?? [],
		url,
	};
}

// ── Function Mode ───────────────────────────────────────────────────────────────

async function executeFunction(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<IDataObject> {
	const functionId = this.getNodeParameter('functionId', itemIndex) as string;
	const variablesParam = this.getNodeParameter('variables', itemIndex, {}) as {
		variableValues?: Array<{ name: string; value: string }>;
	};
	const options = this.getNodeParameter('functionOptions', itemIndex, {}) as {
		waitForCompletion?: boolean;
		timeout?: number;
		pollInterval?: number;
	};

	// Build variables map
	const variables: Record<string, string> = {};
	if (variablesParam.variableValues?.length) {
		for (const v of variablesParam.variableValues) {
			if (v.name) {
				variables[v.name] = v.value;
			}
		}
	}

	// Start the function run
	const runBody: IDataObject = {
		workflow_id: functionId,
	};
	if (Object.keys(variables).length > 0) {
		runBody.variables = variables;
	}

	const credentials = await this.getCredentials('notteApi');
	const runResponse = (await notteApiRequestWithRedirect.call(
		this,
		'POST',
		`/functions/${functionId}/runs/start`,
		runBody,
		{ 'x-notte-api-key': credentials.apiKey as string },
	)) as IDataObject;

	const runId = runResponse.function_run_id as string;
	if (!runId) {
		throw new NodeOperationError(
			this.getNode(),
			'Failed to get function_run_id from run start response',
		);
	}

	const waitForCompletion = options.waitForCompletion ?? true;

	if (!waitForCompletion) {
		return {
			success: true,
			function_id: functionId,
			function_run_id: runId,
			status: 'started',
		};
	}

	// Poll until complete
	const timeoutMs = (options.timeout ?? 300) * 1000;
	const pollIntervalMs = (options.pollInterval ?? 2) * 1000;

	const finalStatus = (await notteApiRequestWithPolling.call(
		this,
		'GET',
		`/functions/${functionId}/runs/${runId}`,
		'status',
		['closed', 'failed', 'stopped'],
		pollIntervalMs,
		timeoutMs,
	)) as IDataObject;

	return {
		success: finalStatus.status === 'closed',
		function_id: functionId,
		function_run_id: runId,
		status: finalStatus.status,
		result: finalStatus.result ?? null,
		logs: finalStatus.logs ?? [],
	};
}
