import { listChannels } from '@hermoso/sdk';
import { brandFrom, fail, hermoso, reply } from '@/lib/hermoso';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    return reply(await listChannels({ client: hermoso(brandFrom(req)) }));
  } catch (e) {
    return fail(e);
  }
}
