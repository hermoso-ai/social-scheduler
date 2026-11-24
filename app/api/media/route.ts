import { createMedia } from '@hermoso/sdk';
import { brandFrom, fail, hermoso, reply } from '@/lib/hermoso';

export const dynamic = 'force-dynamic';

// Turn a file into a Hermoso-hosted URL a post can carry. Two ways in, exactly as the API takes them:
// a JSON body {"url": "https://…"} that Hermoso fetches, or the file's raw bytes with its own Content-Type.
export async function POST(req: Request) {
  const client = hermoso(brandFrom(req));
  const type = req.headers.get('content-type') || '';
  try {
    if (type.includes('application/json')) {
      const { url } = (await req.json()) as { url?: string };
      if (!url || !/^https:\/\//i.test(url)) return fail('Send a public https URL.', 400);
      return reply(await createMedia({ client, query: { url } }));
    }
    const bytes = await req.arrayBuffer();
    if (!bytes.byteLength) return fail('The upload was empty.', 400);
    const name = req.headers.get('x-file-name') || 'upload';
    return reply(
      await createMedia({
        client,
        body: new Blob([bytes], { type }),
        headers: { 'Content-Type': type || 'application/octet-stream', 'X-File-Name': name } as Record<string, string>,
      }),
    );
  } catch (e) {
    return fail(e);
  }
}
