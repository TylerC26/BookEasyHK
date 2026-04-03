import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { sendReminder24h, sendReminder2h } from '@/lib/whatsapp';
import { format, addHours, addDays } from 'date-fns';

/**
 * Reminder cron endpoint.
 * Call this via Supabase Edge Function, Vercel Cron, or external scheduler.
 * GET /api/reminders?type=24h or ?type=2h
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || '24h';

  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );

  const now = new Date();
  let targetDate: string;
  let reminderField: string;

  if (type === '24h') {
    const tomorrow = addDays(now, 1);
    targetDate = format(tomorrow, 'yyyy-MM-dd');
    reminderField = 'reminder_24h_sent';
  } else {
    targetDate = format(now, 'yyyy-MM-dd');
    reminderField = 'reminder_2h_sent';
  }

  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, service:services(*), business:businesses(*)')
    .eq('booking_date', targetDate)
    .eq('status', 'confirmed')
    .eq(reminderField, false);

  if (!bookings || bookings.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  let sent = 0;

  for (const booking of bookings) {
    const wa = booking.customer_whatsapp || booking.customer_phone;
    if (!wa || !booking.business) continue;

    // For 2h reminders, check if within 2-3 hour window
    if (type === '2h') {
      const [h, m] = booking.start_time.split(':').map(Number);
      const bookingTime = new Date();
      bookingTime.setHours(h, m, 0, 0);
      const diffMs = bookingTime.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      if (diffHours < 1.5 || diffHours > 3) continue;
    }

    const success = type === '24h'
      ? await sendReminder24h(wa, {
          businessName: booking.business.name,
          serviceName: booking.service?.name || '',
          date: booking.booking_date,
          time: booking.start_time,
          address: booking.business.district || undefined,
        })
      : await sendReminder2h(wa, {
          businessName: booking.business.name,
          time: booking.start_time,
          address: booking.business.district || undefined,
        });

    if (success) {
      await supabase
        .from('bookings')
        .update({ [reminderField]: true })
        .eq('id', booking.id);
      sent++;
    }
  }

  return NextResponse.json({ sent, total: bookings.length });
}
