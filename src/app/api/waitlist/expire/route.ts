/**
 * GET /api/waitlist/expire
 * Cron endpoint — run every 5 minutes.
 * Finds 'notified' waitlist entries whose 30-minute window has passed and:
 *   1. If an active booking now exists for that slot → mark entry as 'booked'
 *   2. Otherwise → mark entry as 'expired', then call /api/waitlist/process
 *      to notify the next person in the queue.
 *
 * Security: requires Authorization: Bearer <CRON_SECRET>
 *
 * Schedule example (Vercel cron / vercel.json):
 *   { "path": "/api/waitlist/expire", "schedule": "* /5 * * * *" }
 *
 * Or call from Supabase Edge Functions / any external scheduler.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

function makeSupabase() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

/**
 * Extract HK booking_date ("YYYY-MM-DD") + start_time ("HH:MM") from a
 * UTC ISO slot_datetime string using the built-in Intl API.
 */
function parseSlot(slotDatetime: string): { booking_date: string; start_time: string } {
  const d = new Date(slotDatetime);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  const hour = get('hour') === '24' ? '00' : get('hour'); // midnight edge-case

  return {
    booking_date: `${get('year')}-${get('month')}-${get('day')}`,
    start_time: `${hour.padStart(2, '0')}:${get('minute')}`,
  };
}

export async function GET(request: NextRequest) {
  // ── Auth check ────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const supabase = makeSupabase();
  const now = new Date().toISOString();

  // ── Find all notified entries whose expiry has passed ─────────────────────
  const { data: expired, error: fetchError } = await supabase
    .from('waitlist')
    .select('id, business_id, service_id, slot_datetime')
    .eq('status', 'notified')
    .lte('expires_at', now);

  if (fetchError) {
    console.error('[Waitlist/expire] Fetch error:', fetchError);
    return NextResponse.json(
      { error: 'Failed to query expired entries' },
      { status: 500 }
    );
  }

  if (!expired || expired.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  let processed = 0;

  for (const entry of expired) {
    const { booking_date, start_time } = parseSlot(entry.slot_datetime);

    // ── Check if someone actually booked the slot ─────────────────────────
    const { data: activeBooking } = await supabase
      .from('bookings')
      .select('id')
      .eq('business_id', entry.business_id)
      .eq('booking_date', booking_date)
      .eq('start_time', start_time)
      .neq('status', 'cancelled')
      .maybeSingle();

    if (activeBooking) {
      // Customer booked — mark waitlist entry as 'booked'
      await supabase
        .from('waitlist')
        .update({ status: 'booked' })
        .eq('id', entry.id)
        .eq('status', 'notified');
    } else {
      // No booking made — expire this entry and notify the next person
      const { error: expireError } = await supabase
        .from('waitlist')
        .update({ status: 'expired' })
        .eq('id', entry.id)
        .eq('status', 'notified');

      if (!expireError) {
        // Notify the next pending entry for this slot (fire-and-forget)
        const baseUrl =
          process.env.NEXT_PUBLIC_APP_URL ||
          (process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : 'http://localhost:3000');

        fetch(`${baseUrl}/api/waitlist/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            business_id: entry.business_id,
            booking_date,
            start_time,
          }),
        }).catch((err) =>
          console.error('[Waitlist/expire] Process call error:', err)
        );
      }
    }

    processed++;
  }

  return NextResponse.json({ processed, total: expired.length });
}
