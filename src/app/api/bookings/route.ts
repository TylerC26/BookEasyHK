import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendBookingRequestReceived, sendOwnerBookingAlert } from '@/lib/whatsapp';
import { addMinutesToTime } from '@/lib/utils';
import type { BookingQuestion } from '@/lib/types';

type BookingAnswerPayload = {
  question_id: string;
  answer_text: string;
};

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
      customer_image_url,
      booking_date,
      start_time,
      answers,
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

    const normalizedAnswers: BookingAnswerPayload[] = Array.isArray(answers)
      ? answers
          .filter(
            (answer): answer is BookingAnswerPayload =>
              Boolean(answer?.question_id) && typeof answer?.answer_text === 'string'
          )
          .map((answer) => ({
            question_id: answer.question_id,
            answer_text: answer.answer_text.trim(),
          }))
          .filter((answer) => answer.answer_text.length > 0)
      : [];

    const { data: businessQuestions } = await supabase
      .from('booking_questions')
      .select('*')
      .eq('business_id', business_id);

    const allBusinessQuestions = (businessQuestions || []) as BookingQuestion[];
    const allowedQuestions = allBusinessQuestions.filter(
      (question) => question.service_id == null || question.service_id === service_id
    );

    const questionMap = new Map(
      allBusinessQuestions.map((question) => [question.id, question])
    );

    const answeredQuestionIds = new Set(normalizedAnswers.map((answer) => answer.question_id));
    const requiredQuestion = allowedQuestions.find(
      (question) => question.is_required && !answeredQuestionIds.has(question.id)
    );

    if (requiredQuestion) {
      return NextResponse.json(
        { error: 'Please complete all required booking questions' },
        { status: 400 }
      );
    }

    for (const answer of normalizedAnswers) {
      const question = questionMap.get(answer.question_id);

      if (!question) {
        return NextResponse.json(
          { error: 'One or more booking question answers are invalid' },
          { status: 400 }
        );
      }

      if (
        question.input_type === 'yes-no' &&
        answer.answer_text !== 'Yes' &&
        answer.answer_text !== 'No'
      ) {
        return NextResponse.json(
          { error: 'Please answer yes/no questions using the provided options' },
          { status: 400 }
        );
      }

      if (
        question.input_type === 'select' &&
        !((question.options || []).includes(answer.answer_text))
      ) {
        return NextResponse.json(
          { error: 'Please choose a valid option for each booking question' },
          { status: 400 }
        );
      }
    }

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
        customer_image_url: customer_image_url || null,
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

    if (normalizedAnswers.length > 0) {
      const { error: answersError } = await supabase.from('booking_answers').insert(
        normalizedAnswers.map((answer) => ({
          booking_id: booking.id,
          question_id: answer.question_id,
          answer_text: answer.answer_text,
        }))
      );

      if (answersError) {
        await supabase.from('bookings').delete().eq('id', booking.id);
        return NextResponse.json({ error: 'Failed to save booking answers' }, { status: 500 });
      }
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
