import { getPlace } from '@/lib/data';
import { supabaseServer } from '@/lib/supabase/server';
import { decodePublicCatalog } from '@/lib/booking/public-catalog';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!getPlace(id)) return Response.json({ error: 'Place not found' }, { status: 404, headers });
  try {
    const { data, error } = await (await supabaseServer()).from('published_merchant_catalogs').select('place_id,services').eq('place_id', id).maybeSingle();
    if (error) throw new Error('Catalog unavailable');
    return Response.json(decodePublicCatalog(data, id), { headers });
  } catch {
    return Response.json({ error: 'Services are temporarily unavailable' }, { status: 503, headers });
  }
}
