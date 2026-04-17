'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n/context';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatTime } from '@/lib/utils';
import type { Booking } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { MailCheck, UserCheck, X } from 'lucide-react';

const STATUS_BADGE: Record<string, { variant: 'default' | 'success' | 'warning' | 'danger' | 'muted'; label_zh: string; label_en: string }> = {
  pending: { variant: 'warning', label_zh: '待確認', label_en: 'Pending' },
  confirmed: { variant: 'default', label_zh: '已確認', label_en: 'Confirmed' },
  completed: { variant: 'success', label_zh: '已完成', label_en: 'Completed' },
  no_show: { variant: 'danger', label_zh: '爽約', label_en: 'No-Show' },
  cancelled: { variant: 'muted', label_zh: '已取消', label_en: 'Cancelled' },
};

export default function PendingRequestsPage() {
  const { t, locale } = useI18n();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const loadPendingBookings = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: biz } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', user.id)
      .single();

    if (!biz) return;

    const { data } = await supabase
      .from('bookings')
      .select('*, service:services(*), booking_answers(*, question:booking_questions(*))')
      .eq('business_id', biz.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(50);

    setBookings(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const run = async () => {
      await loadPendingBookings();
    };

    void run();
  }, [loadPendingBookings]);

  const updateStatus = async (id: string, status: string) => {
    const supabase = createClient();
    await supabase.from('bookings').update({ status }).eq('id', id);

    // When a booking is cancelled, notify the first person on the waitlist
    // for that slot (fire-and-forget).
    if (status === 'cancelled') {
      const cancelled = bookings.find((b) => b.id === id);
      if (cancelled) {
        fetch('/api/waitlist/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            business_id: cancelled.business_id,
            booking_date: cancelled.booking_date,
            start_time: cancelled.start_time,
          }),
        }).catch(console.error);
      }
    }

    await loadPendingBookings();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('bookingRequests')}</h1>
          <p className="text-sm text-muted mt-1">{t('pendingReviewHint')}</p>
        </div>
        {bookings.length > 0 && (
          <Badge variant="danger">{bookings.length}</Badge>
        )}
      </div>

      <Card>
        {loading ? (
          <div className="text-center py-8 text-muted">{t('loading')}</div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-8 text-muted">{t('noPendingBookings')}</div>
        ) : (
          <div className="space-y-3">
            {bookings.map((booking) => (
              <PendingBookingCard
                key={booking.id}
                booking={booking}
                locale={locale}
                onConfirm={() => updateStatus(booking.id, 'confirmed')}
                onCancel={() => updateStatus(booking.id, 'cancelled')}
                onSelect={() => setSelectedBooking(booking)}
                t={t}
              />
            ))}
          </div>
        )}
      </Card>

      {selectedBooking && (
        <BookingDetailModal
          booking={selectedBooking}
          locale={locale}
          onClose={() => setSelectedBooking(null)}
          onUpdateStatus={async (id, status) => {
            await updateStatus(id, status);
            setSelectedBooking(null);
          }}
          t={t}
        />
      )}
    </div>
  );
}

function PendingBookingCard({
  booking,
  locale,
  onConfirm,
  onCancel,
  onSelect,
  t,
}: {
  booking: Booking;
  locale: string;
  onConfirm: () => void;
  onCancel: () => void;
  onSelect: () => void;
  t: ReturnType<typeof useI18n>['t'];
}) {
  const serviceName = booking.service
    ? locale === 'zh-HK' && booking.service.name_zh
      ? booking.service.name_zh
      : booking.service.name
    : null;

  return (
    <div
      className="border border-amber-200 bg-amber-50/60 rounded-2xl p-4 cursor-pointer hover:bg-amber-50 transition-colors"
      onClick={onSelect}
    >
      <div className="flex gap-3 mb-3 min-w-0">
        {/* Time column */}
        <div className="w-14 shrink-0 flex flex-col items-end gap-1 pt-0.5">
          <span className="text-xs font-semibold text-on-surface leading-none">{formatTime(booking.start_time)}</span>
          <div className="w-px h-3 bg-amber-300 self-center" />
          <span className="text-xs text-muted leading-none">{formatTime(booking.end_time)}</span>
        </div>

        {/* Content with amber left border */}
        <div className="flex-1 min-w-0 border-l-2 border-amber-400 pl-3">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-semibold text-on-surface">{booking.customer_name}</h3>
            <Badge variant="warning">{t('statusPending')}</Badge>
            <span className="inline-flex items-center gap-1 text-xs text-red-600 bg-white/80 border border-red-200 px-2 py-0.5 rounded-full">
              <MailCheck size={12} />
              {locale === 'zh-HK' ? '未讀' : 'Unread'}
            </span>
          </div>
          <div className="text-xs text-muted space-y-0.5">
            <p>{format(parseISO(booking.booking_date), locale === 'zh-HK' ? 'M月d日' : 'MMM d, yyyy')}</p>
            {serviceName && <p>{serviceName}</p>}
            {booking.customer_phone && <p>{booking.customer_phone}</p>}
            {booking.customer_notes && <p className="text-amber-700">{booking.customer_notes}</p>}
          </div>
        </div>
      </div>

      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onConfirm}
          className="flex-1 px-3 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90 cursor-pointer"
        >
          {t('confirmBookingRequest')}
        </button>
        <button
          onClick={() => { if (confirm(t('cancelConfirm'))) onCancel(); }}
          className="px-3 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 cursor-pointer whitespace-nowrap"
        >
          {locale === 'zh-HK' ? '拒絕' : 'Decline'}
        </button>
      </div>
    </div>
  );
}

function BookingDetailModal({
  booking,
  locale,
  onClose,
  onUpdateStatus,
  t,
}: {
  booking: Booking;
  locale: string;
  onClose: () => void;
  onUpdateStatus: (id: string, status: string) => Promise<void>;
  t: ReturnType<typeof useI18n>['t'];
}) {
  const badge = STATUS_BADGE[booking.status];
  const serviceName = booking.service
    ? locale === 'zh-HK' && booking.service.name_zh
      ? booking.service.name_zh
      : booking.service.name
    : null;
  const customerNotesSection = [
    ...(booking.customer_notes
      ? [{ label: locale === 'zh-HK' ? '客人備注' : 'Customer Note', value: booking.customer_notes }]
      : []),
    ...((booking.booking_answers || [])
      .filter((answer) => answer.answer_text?.trim())
      .map((answer) => ({
        label: answer.question?.question_text || (locale === 'zh-HK' ? '附加問題' : 'Booking Question'),
        value: answer.answer_text,
      }))),
  ];

  const rows: { label: string; value: string }[] = [
    { label: locale === 'zh-HK' ? '日期' : 'Date', value: format(parseISO(booking.booking_date), 'MMM d, yyyy') },
    { label: locale === 'zh-HK' ? '時間' : 'Time', value: `${formatTime(booking.start_time)} – ${formatTime(booking.end_time)}` },
    ...(serviceName ? [{ label: locale === 'zh-HK' ? '服務' : 'Service', value: serviceName }] : []),
    ...(booking.customer_phone ? [{ label: locale === 'zh-HK' ? '電話' : 'Phone', value: booking.customer_phone }] : []),
    ...(booking.customer_whatsapp && booking.customer_whatsapp !== booking.customer_phone ? [{ label: 'WhatsApp', value: booking.customer_whatsapp }] : []),
    ...(booking.customer_email ? [{ label: 'Email', value: booking.customer_email }] : []),
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between p-6 pb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-semibold">{booking.customer_name}</h3>
            <Badge variant={badge.variant}>
              {locale === 'zh-HK' ? badge.label_zh : badge.label_en}
            </Badge>
          </div>
          <button onClick={onClose} className="text-muted hover:text-secondary cursor-pointer ml-4 mt-0.5">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 pb-4 space-y-3">
          {customerNotesSection.length > 0 && (
            <div className="rounded-xl bg-[#FAFAFB] border border-[#E5E7EB] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280] mb-3">
                {locale === 'zh-HK' ? '客人備注' : 'Customer Notes'}
              </p>
              <div className="space-y-3">
                {customerNotesSection.map((row) => (
                  <div key={row.label} className="flex items-start gap-3 text-sm">
                    <span className="text-muted w-24 shrink-0">{row.label}</span>
                    <span className="font-medium whitespace-pre-wrap">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {rows.map((row) => (
            <div key={row.label} className="flex items-start gap-3 text-sm">
              <span className="text-muted w-20 shrink-0">{row.label}</span>
              <span className="font-medium">{row.value}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-2 px-6 pb-6 pt-2 border-t border-border mt-2">
          <button
            onClick={() => onUpdateStatus(booking.id, 'confirmed')}
            className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-2 rounded-xl bg-primary text-white hover:opacity-90 transition-colors cursor-pointer"
          >
            <UserCheck size={15} />
            {t('confirmBookingRequest')}
          </button>
          <button
            onClick={() => { if (confirm(t('cancelConfirm'))) void onUpdateStatus(booking.id, 'cancelled'); }}
            className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-2 rounded-xl border border-border hover:bg-red-50 transition-colors cursor-pointer"
          >
            <X size={15} className="text-red-500" />
            {locale === 'zh-HK' ? '取消' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}
