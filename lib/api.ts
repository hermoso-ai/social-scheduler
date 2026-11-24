// Browser-side calls to this app's own routes (never to Hermoso directly: the key lives on the server).
export class AppError extends Error {
  code?: string;
  status: number;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api<T>(path: string, brand: string | null, init: RequestInit = {}): Promise<T> {
  const url = new URL(path, window.location.origin);
  if (brand) url.searchParams.set('brand', brand);
  const res = await fetch(url, init);
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { error: { message: text.slice(0, 300) } };
  }
  if (!res.ok) {
    const e = (body as { error?: { message?: string; code?: string } })?.error;
    throw new AppError(e?.message || `Request failed (HTTP ${res.status})`, res.status, e?.code);
  }
  return body as T;
}
