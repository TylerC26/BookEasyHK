import { NextResponse } from 'next/server';
import { requireAdmin, createServiceClient } from '@/lib/admin';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: 'forbidden' }, { status: auth.status });

  const db = createServiceClient();

  const [shopsTotal, shopsActive, bookingsTotal, bookingsPending, bookings30d] = await Promise.all([
    db.from('businesses').select('id', { count: 'exact', head: true }),
    db.from('businesses').select('id', { count: 'exact', head: true }).eq('onboarding_complete', true),
    db.from('bookings').select('id', { count: 'exact', head: true }),
    db.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    db
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
  ]);

  const { data: revenueRows } = await db
    .from('bookings')
    .select('price_hkd')
    .eq('status', 'completed');

  const totalRevenue = (revenueRows || []).reduce((sum, r) => sum + (r.price_hkd || 0), 0);

  const { data: recentShops } = await db
    .from('businesses')
    .select('id, name, type, slug, district, created_at, onboarding_complete')
    .order('created_at', { ascending: false })
    .limit(5);

  return NextResponse.json({
    shopsTotal: shopsTotal.count || 0,
    shopsActive: shopsActive.count || 0,
    bookingsTotal: bookingsTotal.count || 0,
    bookingsPending: bookingsPending.count || 0,
    bookings30d: bookings30d.count || 0,
    totalRevenue,
    recentShops: recentShops || [],
  });
}
