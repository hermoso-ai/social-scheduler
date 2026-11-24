import { getBestTime } from '@hermoso/sdk';
import { brandFrom, fail, hermoso, reply } from '@/lib/hermoso';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  try {
    return reply(
      await getBestTime({
        client: hermoso(brandFrom(req)),
        query: {
          timezone: q.get('timezone') || undefined,
          channel: q.get('channel') || undefined,
          days: q.get('days') ? Number(q.get('days')) : undefined,
        },
      }),
    );
  } catch (e) {
    return fail(e);
  }
}
