// Server-only helpers around the official Hermoso SDK. The API key is read from HERMOSO_API_KEY on the server and
// never reaches the browser: every page talks to the routes under app/api, and those routes talk to Hermoso.
import 'server-only';
import { createHermosoClient } from '@hermoso/sdk';
import { NextResponse } from 'next/server';

export type Client = ReturnType<typeof createHermosoClient>;

/** A client for one brand (profile). `brand` is an id from GET /v1/brands; empty means the key's own default. */
export function hermoso(brand?: string | null): Client {
  const b = (brand || process.env.HERMOSO_BRAND || '').trim();
  return createHermosoClient(b ? { brand: b } : {});
}

export function brandFrom(req: Request): string | null {
  return new URL(req.url).searchParams.get('brand');
}

type SdkResult<T> = { data?: T; error?: unknown; response?: Response };

/** Turn an SDK result into a JSON response: the data on success, the API's own error body and status otherwise. */
export function reply<T>(res: SdkResult<T>, okStatus = 200) {
  if (res.error !== undefined || res.data === undefined) {
    const status = res.response?.status && res.response.status >= 400 ? res.response.status : 502;
    const body = isErrorBody(res.error) ? res.error : { error: { type: 'api_error', code: 'upstream', message: describe(res.error) } };
    return NextResponse.json(body, { status });
  }
  return NextResponse.json(res.data, { status: okStatus });
}

/** For code paths that throw (a missing key, a network failure): the same error shape the API uses. */
export function fail(e: unknown, status = 500) {
  return NextResponse.json({ error: { type: 'api_error', code: 'app_error', message: describe(e) } }, { status });
}

function isErrorBody(x: unknown): x is { error: { message: string } } {
  return !!x && typeof x === 'object' && 'error' in x && !!(x as { error?: { message?: unknown } }).error?.message;
}

function describe(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  try { return JSON.stringify(e); } catch { return 'Unknown error'; }
}
