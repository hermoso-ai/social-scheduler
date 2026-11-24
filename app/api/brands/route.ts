import { listBrands } from '@hermoso/sdk';
import { NextResponse } from 'next/server';
import { fail, hermoso } from '@/lib/hermoso';

export const dynamic = 'force-dynamic';

// The brands (profiles) this key can act on, plus which one the app should open on.
export async function GET() {
  try {
    const res = await listBrands({ client: hermoso() });
    if (res.error !== undefined || !res.data) {
      return NextResponse.json(res.error ?? { error: { message: 'Could not list brands' } }, { status: res.response?.status || 502 });
    }
    const brands = (res.data.data || []).map((b) => ({ id: b.id, name: b.name, current: b.current, shared: b.shared }));
    const preferred = (process.env.HERMOSO_BRAND || '').trim();
    const fallback = brands.find((b) => b.current)?.id || brands[0]?.id || null;
    const initial = preferred && brands.some((b) => b.id === preferred) ? preferred : fallback;
    return NextResponse.json({ brands, initial });
  } catch (e) {
    return fail(e);
  }
}
