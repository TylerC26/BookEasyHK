import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendBookingRequestReceived, sendOwnerBookingAlert } from '@/lib/whatsapp';
import { addMinutesToTime } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      business_id,
      service_id,
      customer_name,
      customer_phone,
      customer_whatsapp,
      customer_notes,
      booking_date,
      start_time,
    } = body;

    if (!business_id || !customer_name || !booking_date || !start_time) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = await createClient();

    // Load service for duration
    let duration = 60;
    let serviceName = '';
    let servicePrice: number | null = null;
    if (service_id) {
      const { data: svc } = await supabase
        .from('services')
        .select('*')
        .eq('id', service_id)
        .single();

      if (svc) {
        duration = svc.duration_minutes;
        serviceName = svc.name;
        servicePrice = svc.price_hkd;
      }
    }

    const end_time = addMinutesToTime(start_time, duration);

    // Double-booking prevention
    const { data: hasOverlap } = await supabase.rpc('check_booking_overlap', {
      p_business_id: business_id,
      p_booking_date: booking_date,
      p_start_time: start_time,
      p_end_time: end_time,
    });

    if (hasOverlap) {
      return NextResponse.json(
        { error: 'Time slot is no longer available' },
        { status: 409 }
      );
    }

    // Blocked time check
    const { data: isBlocked } = await supabase.rpc('check_blocked_overlap', {
      p_business_id: business_id,
      p_date: booking_date,
      p_start_time: start_time,
      p_end_time: end_time,
    });

    if (isBlocked) {
      return NextResponse.json(
        { error: 'This time slot is blocked' },
        { status: 409 }
      );
    }

    // Create booking
    const { data: booking, error } = await supabase
      .from('bookings')
      .insert({
        business_id,
        service_id: service_id || null,
        price_hkd: servicePrice,
        customer_name,
        customer_phone: customer_phone || null,
        customer_whatsapp: customer_whatsapp || customer_phone || null,
        customer_notes: customer_notes || null,
        booking_date,
        start_time,
        end_time,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('[Booking] Insert error:', error);
      if (
        error.code === '23514' ||
        error.message?.includes('status') ||
        error.message?.includes('check constraint')
      ) {
        return NextResponse.json(
          {
            error: 'Booking status schema is outdated. Apply the pending-bookings database migration first.',
          },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 });
    }

    // Load business for notifications
    const { data: business } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', business_id)
      .single();

    // Send WhatsApp notifications (fire-and-forget)
    if (business) {
      const wa = customer_whatsapp || customer_phone;
      if (wa) {
        sendBookingRequestReceived(wa, {
          businessName: business.name,
          serviceName,
          date: booking_date,
          time: start_time,
          address: business.district || undefined,
        }).catch(console.error);
      }

      if (business.whatsapp) {
        sendOwnerBookingAlert(business.whatsapp, {
          customerName: customer_name,
          serviceName,
          date: booking_date,
          time: start_time,
          phone: customer_phone || undefined,
        }).catch(console.error);
      }
    }

    return NextResponse.json({ booking }, { status: 201 });
  } catch (err) {
    console.error('[Booking] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
