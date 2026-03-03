/* eslint-disable @n8n/community-nodes/no-restricted-imports, @n8n/community-nodes/no-restricted-globals */
import 'dotenv/config';

const BASE_URL = 'https://api.notte.cc';

export function getApiKey(): string {
	const key = process.env.NOTTE_API_KEY;
	if (!key) {
		throw new Error('NOTTE_API_KEY is not set');
	}
	return key;
}

function buildHeaders(auth: 'bearer' | 'both' = 'bearer'): Record<string, string> {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		Authorization: `Bearer ${getApiKey()}`,
	};
	if (auth === 'both') {
		headers['x-notte-api-key'] = getApiKey();
	}
	return headers;
}

export async function makeApiRequest<T = unknown>(
	method: string,
	endpoint: string,
	body?: Record<string, unknown>,
	qs?: Record<string, string>,
	auth: 'bearer' | 'both' = 'bearer',
): Promise<T> {
	const url = new URL(`${BASE_URL}${endpoint}`);
	if (qs) {
		for (const [key, value] of Object.entries(qs)) {
			url.searchParams.set(key, value);
		}
	}

	const headers = buildHeaders(auth);
	const jsonBody = body ? JSON.stringify(body) : undefined;

	// Handle redirects manually to preserve auth headers across origins
	let response = await fetch(url.toString(), {
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
		throw new Error(`API ${method} ${endpoint} failed (${response.status}): ${text}`);
	}

	return response.json() as Promise<T>;
}

export async function pollUntilDone<T extends { status: string }>(
	endpoint: string,
	intervalMs = 3000,
	maxAttempts = 40,
): Promise<T> {
	const terminalStatuses = new Set(['closed', 'failed', 'error', 'completed']);

	for (let i = 0; i < maxAttempts; i++) {
		const result = await makeApiRequest<T>('GET', endpoint);
		if (terminalStatuses.has(result.status)) {
			return result;
		}
		await new Promise((resolve) => setTimeout(resolve, intervalMs));
	}

	throw new Error(`Timed out waiting for ${endpoint} to reach terminal status`);
}
