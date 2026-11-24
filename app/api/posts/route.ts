import { createPost, listPosts, type Post, type PostCreate } from '@hermoso/sdk';
import { NextResponse } from 'next/server';
import { brandFrom, fail, hermoso, reply } from '@/lib/hermoso';

export const dynamic = 'force-dynamic';

const MAX_PAGES = 20;

// Posts in a date window. The API lists newest first (by scheduled time) with a cursor, so we follow the cursor until
// a page reaches back past `from`, and keep the posts inside [from, to).
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const from = q.get('from') ? Date.parse(q.get('from')!) : -Infinity;
  const to = q.get('to') ? Date.parse(q.get('to')!) : Infinity;
  const client = hermoso(brandFrom(req));
  try {
    const out: Post[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await listPosts({ client, query: { limit: 100, ...(cursor ? { starting_after: cursor } : {}) } });
      if (res.error !== undefined || !res.data) return reply(res);
      const rows = res.data.data || [];
      let reachedBack = false;
      for (const p of rows) {
        const t = when(p);
        if (t === null) continue;
        if (t >= from && t < to) out.push(p);
        if (t < from) reachedBack = true;
      }
      cursor = res.data.next_cursor || undefined;
      if (reachedBack || !res.data.has_more || !cursor) break;
    }
    return NextResponse.json({ data: out });
  } catch (e) {
    return fail(e);
  }
}

function when(p: Post): number | null {
  const s = p.scheduled_at || p.created_at;
  const t = s ? Date.parse(s) : NaN;
  return Number.isFinite(t) ? t : null;
}

// Publish now or schedule. The browser sends one Idempotency-Key per composed post, so a retry after a network
// error can never post twice.
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as PostCreate;
    const key = req.headers.get('idempotency-key') || crypto.randomUUID();
    return reply(await createPost({ client: hermoso(brandFrom(req)), body, headers: { 'Idempotency-Key': key } }));
  } catch (e) {
    return fail(e, 400);
  }
}
