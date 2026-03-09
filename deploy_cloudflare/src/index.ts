/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

const API_HANDLERS = {
	"jobnimbus": fetchJobNimbus,
} as { [key: string]: (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response> };

function setCorsHeaders(headers: Headers): Headers {
	headers.set('Access-Control-Allow-Origin', 'http://localhost:5173');
	headers.set('Access-Control-Allow-Credentials', 'true');
	headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
	headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
	return headers;
}

async function fetchJobNimbus(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
	const url = new URL(request.url);
	const targetUrl = `https://app.jobnimbus.com${url.pathname}${url.search}`;

	const reqHeaders = new Headers();
	// forward auth header
	const incomingAuth = request.headers.get('Authorization');
	if (incomingAuth) {
		reqHeaders.set('Authorization', incomingAuth);
	}
	// forward content-type if present (e.g., POST/PUT)
	const incomingContentType = request.headers.get('content-type');
	if (incomingContentType) {
		reqHeaders.set('content-type', incomingContentType);
	}
	// forward content-length
	const contentLength = request.headers.get('content-length');
	if (contentLength) {
		reqHeaders.set('content-length', contentLength);
	}

	if (request.method === 'OPTIONS') {
		return new Response(null, { status: 204, headers: setCorsHeaders(new Headers()) });
	}

	// make the request
	const response = await fetch(targetUrl, {
		headers: reqHeaders,
		method: request.method,
		body: request.body,
	});

	const modifiedHeaders = setCorsHeaders(new Headers(response.headers));
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers: modifiedHeaders,
	})
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const segments = url.pathname.split('/').filter(Boolean);

		if (segments[0] === "api") {
			const apiName = segments[1];
			const handler = API_HANDLERS[apiName];
			if (!handler) {
				return new Response(`API route ${apiName} not found`, { status: 404 });
			}

			// rewrite the request to remove the "/api/<apiName>/" prefix
			const remainingPath = segments.slice(2).join('/');
			const newUrl = new URL(request.url);
			newUrl.pathname = '/' + remainingPath;
			const rewrittenRequest = new Request(newUrl.toString(), request);

			return handler(rewrittenRequest, env, ctx);
		}

		// fallback to serving index.html
		const indexUrl = new URL("/index.html", url.origin);
		return env.ASSETS.fetch(indexUrl);
	},
} satisfies ExportedHandler<Env>;
