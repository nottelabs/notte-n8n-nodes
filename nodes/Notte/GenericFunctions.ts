import type {
	IDataObject,
	IExecuteFunctions,
	IN8nHttpFullResponse,
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

	const headers: IDataObject = {
		Accept: 'application/json',
		'Content-Type': 'application/json',
		Authorization: `Bearer ${credentials.apiKey as string}`,
		...extraHeaders,
	};

	const options: IHttpRequestOptions = {
		method,
		url: `${baseUrl}${endpoint}`,
		headers,
		json: true,
		returnFullResponse: true,
		disableFollowRedirect: true,
		ignoreHttpStatusErrors: true,
	};

	if (body && Object.keys(body).length > 0) {
		options.body = body;
	}

	let response = (await this.helpers.httpRequest(options)) as IN8nHttpFullResponse;

	if (response.statusCode >= 300 && response.statusCode < 400) {
		const locationHeader = getResponseHeader(response.headers, 'location');
		const location = locationHeader ? new URL(locationHeader, options.url).toString() : undefined;

		if (location) {
			response = (await this.helpers.httpRequest({
				...options,
				url: location,
				disableFollowRedirect: false,
			})) as IN8nHttpFullResponse;
		}
	}

	if (response.statusCode < 200 || response.statusCode >= 300) {
		const detail = stringifyResponseBody(response.body);
		throw new NodeOperationError(
			this.getNode(),
			`Notte API error (${endpoint}): ${response.statusCode} ${detail}`,
		);
	}

	return response.body;
}

function getResponseHeader(headers: IDataObject, headerName: string): string | undefined {
	const matchingKey = Object.keys(headers).find(
		(key) => key.toLowerCase() === headerName.toLowerCase(),
	);

	const value = matchingKey ? headers[matchingKey] : undefined;

	if (Array.isArray(value)) {
		return value.find((item): item is string => typeof item === 'string');
	}

	return typeof value === 'string' ? value : undefined;
}

function stringifyResponseBody(body: IN8nHttpFullResponse['body']): string {
	if (body === null || body === undefined) {
		return 'Unknown error';
	}

	if (Buffer.isBuffer(body)) {
		return body.toString('utf8');
	}

	if (typeof body === 'string' || typeof body === 'number' || typeof body === 'boolean') {
		return String(body);
	}

	if (typeof body === 'object') {
		return JSON.stringify(body);
	}

	return 'Unknown error';
}
