import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, createServiceClient } from '@/lib/admin';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: 'forbidden' }, { status: auth.status });

  const { id } = await params;
  const db = createServiceClient();

  const { data: shop, error: shopErr } = await db
    .from('businesses')
    .select('*')
    .eq('id', id)
    .single();

  if (shopErr || !shop) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const [servicesRes, bookingsRes, workingHoursRes, ownerRes] = await Promise.all([
    db.from('services').select('*').eq('business_id', id).order('sort_order'),
    db
      .from('bookings')
      .select('*, service:services(*)')
      .eq('business_id', id)
      .order('booking_date', { ascending: false })
      .order('start_time', { ascending: false })
      .limit(25),
    db.from('working_hours').select('*').eq('business_id', id).order('day_of_week'),
    db.auth.admin.getUserById(shop.owner_id).catch(() => ({ data: { user: null } })),
  ]);

  const { data: allBookings } = await db
    .from('bookings')
    .select('status, price_hkd')
    .eq('business_id', id);

  const byStatus = { pending: 0, confirmed: 0, completed: 0, no_show: 0, cancelled: 0 };
  let revenue = 0;
  for (const b of allBookings || []) {
    if (b.status in byStatus) byStatus[b.status as keyof typeof byStatus] += 1;
    if (b.status === 'completed') revenue += b.price_hkd || 0;
  }

  const ownerUser = 'data' in ownerRes ? ownerRes.data?.user : null;

  return NextResponse.json({
    shop,
    services: servicesRes.data || [],
    bookings: bookingsRes.data || [],
    workingHours: workingHoursRes.data || [],
    stats: {
      totalBookings: (allBookings || []).length,
      revenue,
      byStatus,
    },
    owner: ownerUser
      ? { id: ownerUser.id, email: ownerUser.email, created_at: ownerUser.created_at }
      : null,
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: 'forbidden' }, { status: auth.status });

  const { id } = await params;
  const db = createServiceClient();

  const { error } = await db.from('businesses').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
