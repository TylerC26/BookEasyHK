/**
 * POST /api/waitlist/process
 * Called immediately after a booking is cancelled (from dashboard pages).
 * Finds the first pending waitlist entry for the freed slot, marks it as
 * 'notified', and sends a WhatsApp message with a 30-minute booking link.
 *
 * Body:
 *   business_id   string  (UUID)
 *   booking_date  string  "YYYY-MM-DD"
 *   start_time    string  "HH:MM"
 *
 * Returns: { notified: WaitlistEntry | null }
 *   null when no pending entry exists for this slot.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { sendWaitlistSlotOpened } from '@/lib/whatsapp';
import { format } from 'date-fns';

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

function toSlotDatetime(date: string, time: string): string {
  return new Date(`${date}T${time}:00+08:00`).toISOString();
}

function makeSupabase() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { business_id, booking_date, start_time } = body as {
      business_id: string;
      booking_date: string;
      start_time: string;
    };

    if (!business_id || !booking_date || !start_time) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = makeSupabase();
    const slot_datetime = toSlotDatetime(booking_date, start_time);

    // ── Find the first pending entry for this slot (lowest position) ──────────
    const { data: entry, error: fetchError } = await supabase
      .from('waitlist')
      .select('*, service:services(name, name_zh), business:businesses(name, slug)')
      .eq('business_id', business_id)
      .eq('slot_datetime', slot_datetime)
      .eq('status', 'pending')
      .order('position', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error('[Waitlist/process] Fetch error:', fetchError);
      return NextResponse.json(
        { error: 'Failed to query waitlist' },
        { status: 500 }
      );
    }

    // No one is waiting for this slot
    if (!entry) {
      return NextResponse.json({ notified: null });
    }

    // ── Mark as notified with a 30-minute expiry ──────────────────────────────
    const notifiedAt = new Date();
    const expiresAt = new Date(notifiedAt.getTime() + 30 * 60 * 1000);

    const { data: updated, error: updateError } = await supabase
      .from('waitlist')
      .update({
        status: 'notified',
        notified_at: notifiedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .eq('id', entry.id)
      .eq('status', 'pending') // guard against race conditions
      .select()
      .maybeSingle();

    if (updateError || !updated) {
      // Another process beat us to it — that's fine
      console.warn('[Waitlist/process] Update skipped (race condition):', updateError);
      return NextResponse.json({ notified: null });
    }

    // ── Build the booking link with pre-filled slot params ────────────────────
    const slug = entry.business?.slug ?? '';
    const serviceId = entry.service_id ?? '';
    const bookingLink = [
      `${APP_URL}/book/${slug}`,
      `?date=${booking_date}`,
      `&time=${start_time}`,
      serviceId ? `&service=${serviceId}` : '',
      `&wt=${entry.id}`, // waitlist token for pre-fill + countdown
    ].join('');

    // ── Send WhatsApp notification (fire-and-forget) ──────────────────────────
    const businessName = entry.business?.name ?? '';
    const serviceName =
      entry.service?.name ?? (serviceId ? 'Service' : 'Appointment');
    const displayTime = start_time; // "14:00"
    const displayDate = format(
      new Date(`${booking_date}T12:00:00`),
      'MMM d, yyyy'
    );

    sendWaitlistSlotOpened(entry.customer_whatsapp, {
      businessName,
      serviceName,
      date: displayDate,
      time: displayTime,
      bookingLink,
    }).catch((err) =>
      console.error('[Waitlist/process] WhatsApp send error:', err)
    );

    return NextResponse.json({ notified: updated });
  } catch (err) {
    console.error('[Waitlist/process] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
