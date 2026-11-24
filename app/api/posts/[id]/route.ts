import { deletePost, getPost, updatePost, type PostUpdate } from '@hermoso/sdk';
import { brandFrom, fail, hermoso, reply } from '@/lib/hermoso';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    return reply(await getPost({ client: hermoso(brandFrom(req)), path: { id } }));
  } catch (e) {
    return fail(e);
  }
}

// Edit or reschedule. Only works while the post is still `scheduled`; the API re-runs the same checks as a create.
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const body = (await req.json()) as PostUpdate;
    return reply(await updatePost({ client: hermoso(brandFrom(req)), path: { id }, body }));
  } catch (e) {
    return fail(e, 400);
  }
}

// Cancel a scheduled post. A post that has already gone out stays on the channel.
export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    return reply(await deletePost({ client: hermoso(brandFrom(req)), path: { id } }));
  } catch (e) {
    return fail(e);
  }
}
