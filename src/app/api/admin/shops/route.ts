import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, createServiceClient } from '@/lib/admin';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: 'forbidden' }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const search = (searchParams.get('search') || '').trim();
  const type = searchParams.get('type') || '';
  const status = searchParams.get('status') || '';
  const sort = searchParams.get('sort') || 'created_desc';

  const db = createServiceClient();
  let query = db.from('businesses').select('*');

  if (search) {
    const esc = search.replace(/[,%]/g, '');
    query = query.or(
      `name.ilike.%${esc}%,slug.ilike.%${esc}%,phone.ilike.%${esc}%,district.ilike.%${esc}%`
    );
  }
  if (type) query = query.eq('type', type);
  if (status === 'active') query = query.eq('onboarding_complete', true);
  if (status === 'pending') query = query.eq('onboarding_complete', false);

  switch (sort) {
    case 'created_asc':
      query = query.order('created_at', { ascending: true });
      break;
    case 'name_asc':
      query = query.order('name', { ascending: true });
      break;
    case 'name_desc':
      query = query.order('name', { ascending: false });
      break;
    default:
      query = query.order('created_at', { ascending: false });
  }

  const { data: shops, error } = await query.limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const shopIds = (shops || []).map((s) => s.id);
  const countsByShop: Record<string, { bookings: number; revenue: number }> = {};

  if (shopIds.length > 0) {
    const { data: bookingRows } = await db
      .from('bookings')
      .select('business_id, price_hkd, status')
      .in('business_id', shopIds);

    for (const row of bookingRows || []) {
      const rec = countsByShop[row.business_id] || { bookings: 0, revenue: 0 };
      rec.bookings += 1;
      if (row.status === 'completed') rec.revenue += row.price_hkd || 0;
      countsByShop[row.business_id] = rec;
    }
  }

  const enriched = (shops || []).map((s) => ({
    ...s,
    _bookings: countsByShop[s.id]?.bookings || 0,
    _revenue: countsByShop[s.id]?.revenue || 0,
  }));

  return NextResponse.json({ shops: enriched });
}
