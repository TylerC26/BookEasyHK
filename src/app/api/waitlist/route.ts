/**
 * POST /api/waitlist
 * Join the waitlist for a fully-occupied time slot.
 *
 * Body:
 *   business_id       string (UUID)
 *   service_id        string (UUID) | null
 *   booking_date      string  "YYYY-MM-DD"
 *   start_time        string  "HH:MM"
 *   customer_name     string
 *   customer_whatsapp string
 *
 * Returns: { entry: WaitlistEntry }  (201)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/** Build a HK-timezone ISO timestamp from a date string + time string */
function toSlotDatetime(date: string, time: string): string {
  // e.g. "2026-04-11" + "14:00"  →  "2026-04-11T14:00:00+08:00"
  return new Date(`${date}T${time}:00+08:00`).toISOString();
}

function makeSupabase() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

async function getFallbackWaitlistPosition(
  supabase: ReturnType<typeof createServerClient>,
  business_id: string,
  slot_datetime: string
) {
  const { count, error } = await supabase
    .from('waitlist')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', business_id)
    .eq('slot_datetime', slot_datetime)
    .in('status', ['pending', 'notified']);

  if (error) {
    return { position: null, error };
  }

  return { position: (count ?? 0) + 1, error: null };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      business_id,
      service_id,
      booking_date,
      start_time,
      customer_name,
      customer_whatsapp,
    } = body as {
      business_id: string;
      service_id?: string | null;
      booking_date: string;
      start_time: string;
      customer_name: string;
      customer_whatsapp: string;
    };

    // ── Validate required fields ──────────────────────────────────────────────
    if (
      !business_id ||
      !booking_date ||
      !start_time ||
      !customer_name?.trim() ||
      !customer_whatsapp?.trim()
    ) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = makeSupabase();
    const slot_datetime = toSlotDatetime(booking_date, start_time);

    // ── Prevent duplicate entries for the same customer + slot ────────────────
    const { data: existing } = await supabase
      .from('waitlist')
      .select('id, position, status')
      .eq('business_id', business_id)
      .eq('slot_datetime', slot_datetime)
      .eq('customer_whatsapp', customer_whatsapp.replace(/[^0-9+]/g, ''))
      .in('status', ['pending', 'notified'])
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        {
          error: 'already_waitlisted',
          message: 'You are already on the waitlist for this slot',
          position: existing.position,
        },
        { status: 409 }
      );
    }

    // ── Calculate next position using the DB helper function ─────────────────
    const { data, error: posError } = await supabase.rpc(
      'get_waitlist_position',
      { p_business_id: business_id, p_slot_datetime: slot_datetime }
    );
    let posData = data;

    if (posError) {
      if (posError.code === 'PGRST202') {
        console.warn(
          '[Waitlist] Position RPC missing from schema cache, falling back to direct count.',
          posError
        );

        const fallback = await getFallbackWaitlistPosition(
          supabase,
          business_id,
          slot_datetime
        );

        if (fallback.error) {
          console.error('[Waitlist] Position fallback error:', fallback.error);
          return NextResponse.json(
            { error: 'Failed to calculate queue position' },
            { status: 500 }
          );
        }

        posData = fallback.position;
      } else {
        console.error('[Waitlist] Position RPC error:', posError);
        return NextResponse.json(
          { error: 'Failed to calculate queue position' },
          { status: 500 }
        );
      }
    }

    const position: number = posData ?? 1;

    // ── Insert waitlist entry ─────────────────────────────────────────────────
    const { data: entry, error: insertError } = await supabase
      .from('waitlist')
      .insert({
        business_id,
        service_id: service_id ?? null,
        slot_datetime,
        customer_name: customer_name.trim(),
        customer_whatsapp: customer_whatsapp.trim(),
        position,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError || !entry) {
      console.error('[Waitlist] Insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to join waitlist' },
        { status: 500 }
      );
    }

    return NextResponse.json({ entry }, { status: 201 });
  } catch (err) {
    console.error('[Waitlist] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
