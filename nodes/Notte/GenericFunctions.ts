import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	ILoadOptionsFunctions,
	IPollFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
} from 'n8n-workflow';
import { NodeOperationError, sleep } from 'n8n-workflow';

export async function notteApiRequest(
	this: IExecuteFunctions | ILoadOptionsFunctions | IPollFunctions | IHookFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body?: object,
	qs?: Record<string, string | number | boolean>,
	extraHeaders?: Record<string, string>,
): Promise<unknown> {
	const credentials = await this.getCredentials('notteApi');
	const baseUrl = (credentials.baseUrl as string) || 'https://api.notte.cc';

	const options: IHttpRequestOptions = {
		method,
		url: `${baseUrl}${endpoint}`,
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			Authorization: `Bearer ${credentials.apiKey as string}`,
			...extraHeaders,
		},
		json: true,
	};

	if (body && Object.keys(body).length > 0) {
		options.body = body;
	}

	if (qs && Object.keys(qs).length > 0) {
		options.qs = qs;
	}

	try {
		return await this.helpers.httpRequest(options);
	} catch (error: unknown) {
		const err = error as { response?: { data?: unknown }; message?: string };
		const detail = err.response?.data
			? JSON.stringify(err.response.data)
			: (err.message ?? 'Unknown error');
		throw new NodeOperationError(this.getNode(), `Notte API error (${endpoint}): ${detail}`);
	}
}

export async function notteApiRequestWithPolling(
	this: IExecuteFunctions,
	pollMethod: IHttpRequestMethods,
	pollEndpoint: string,
	statusField: string,
	terminalStatuses: string[],
	pollIntervalMs: number = 2000,
	timeoutMs: number = 300000,
): Promise<unknown> {
	const startTime = Date.now();

	while (Date.now() - startTime < timeoutMs) {
		const response = (await notteApiRequest.call(this, pollMethod, pollEndpoint)) as IDataObject;
		const status = response[statusField] as string;

		if (terminalStatuses.includes(status)) {
			return response;
		}

		await sleep(pollIntervalMs);
	}

	throw new NodeOperationError(
		this.getNode(),
		`Polling timed out after ${timeoutMs / 1000}s waiting for ${pollEndpoint}`,
	);
}

export async function notteApiRequestWithRedirect(
	this: IExecuteFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body?: object,
	extraHeaders?: Record<string, string>,
): Promise<unknown> {
	const credentials = await this.getCredentials('notteApi');
	const baseUrl = (credentials.baseUrl as string) || 'https://api.notte.cc';

	const headers: Record<string, string> = {
		Accept: 'application/json',
		'Content-Type': 'application/json',
		Authorization: `Bearer ${credentials.apiKey as string}`,
		...extraHeaders,
	};

	const jsonBody = body && Object.keys(body).length > 0 ? JSON.stringify(body) : undefined;

	let response = await fetch(`${baseUrl}${endpoint}`, {
		method,
		headers,
		body: jsonBody,
		redirect: 'manual',
	});

	if (response.status >= 300 && response.status < 400) {
		const location = response.headers.get('location');
		if (location) {
			response = await fetch(location, {
				method,
				headers,
				body: jsonBody,
			});
		}
	}

	if (!response.ok) {
		const text = await response.text();
		throw new NodeOperationError(
			this.getNode(),
			`Notte API error (${endpoint}): ${response.status} ${text}`,
		);
	}

	return response.json();
}
