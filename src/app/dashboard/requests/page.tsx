'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n/context';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatPrice, formatTime } from '@/lib/utils';
import type { Booking } from '@/lib/types';
import { differenceInCalendarDays, format, parseISO, startOfToday } from 'date-fns';
import { AlertTriangle, DollarSign, ImageIcon, MailCheck, UserCheck, X } from 'lucide-react';

const STATUS_BADGE: Record<string, { variant: 'default' | 'success' | 'warning' | 'danger' | 'muted'; label_zh: string; label_en: string }> = {
  pending: { variant: 'warning', label_zh: '待確認', label_en: 'Pending' },
  confirmed: { variant: 'default', label_zh: '已確認', label_en: 'Confirmed' },
  completed: { variant: 'success', label_zh: '已完成', label_en: 'Completed' },
  no_show: { variant: 'danger', label_zh: '爽約', label_en: 'No-Show' },
  cancelled: { variant: 'muted', label_zh: '已取消', label_en: 'Cancelled' },
};

function getPendingTimingAlert(bookingDate: string, locale: string) {
  const daysUntilBooking = differenceInCalendarDays(parseISO(bookingDate), startOfToday());

  if (daysUntilBooking < 0) {
    return locale === 'zh-HK' ? '預約日期已過，仍未確認' : 'Booking date has passed and is still unconfirmed';
  }

  if (daysUntilBooking === 0) {
    return locale === 'zh-HK' ? '今日預約，仍未確認' : 'Today and still unconfirmed';
  }

  if (daysUntilBooking === 1) {
    return locale === 'zh-HK' ? '明日預約，仍未確認' : 'Tomorrow and still unconfirmed';
  }

  return null;
}

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

  const updateStatus = async (
    id: string,
    status: string,
    extras: { price_hkd?: number } = {}
  ) => {
    const supabase = createClient();
    await supabase
      .from('bookings')
      .update({ status, ...extras })
      .eq('id', id);

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
          onUpdateStatus={async (id, status, extras) => {
            await updateStatus(id, status, extras);
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
  const timingAlert = getPendingTimingAlert(booking.booking_date, locale);
  const needsFinalPrice = booking.service?.pricing_type === 'tbc' && booking.price_hkd == null;

  return (
    <div
      className={`border rounded-2xl p-4 cursor-pointer transition-colors ${
        timingAlert
          ? 'border-red-300 bg-red-50/70 hover:bg-red-50'
          : 'border-amber-200 bg-amber-50/60 hover:bg-amber-50'
      }`}
      onClick={onSelect}
    >
      {timingAlert && (
        <div className="mb-3 inline-flex max-w-full items-center gap-1.5 rounded-full border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-700">
          <AlertTriangle size={13} className="shrink-0" />
          <span className="truncate">{timingAlert}</span>
        </div>
      )}

      <div className="flex gap-3 min-w-0">
        {/* Time column */}
        <div className="w-14 shrink-0 flex flex-col items-end gap-1 pt-0.5">
          <span className="text-xs font-semibold text-on-surface leading-none">{formatTime(booking.start_time)}</span>
          <div className="w-px h-3 bg-amber-300 self-center" />
          <span className="text-xs text-muted leading-none">{formatTime(booking.end_time)}</span>
        </div>

        {/* Content with left border */}
        <div className={`flex-1 min-w-0 border-l-2 pl-3 ${timingAlert ? 'border-red-400' : 'border-amber-400'}`}>
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <h3 className="font-semibold text-on-surface">{booking.customer_name}</h3>
            <Badge variant="warning">{t('statusPending')}</Badge>
            <span className="inline-flex items-center gap-1 text-xs text-red-600 bg-white/80 border border-red-200 px-2 py-0.5 rounded-full">
              <MailCheck size={12} />
              {locale === 'zh-HK' ? '未讀' : 'Unread'}
            </span>
            {booking.customer_image_url && (
              <span className="inline-flex items-center gap-1 text-xs text-violet-700 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full">
                <ImageIcon size={11} />
                {locale === 'zh-HK' ? '附圖' : 'Photo'}
              </span>
            )}
            {needsFinalPrice && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
                <DollarSign size={11} />
                {locale === 'zh-HK' ? '需輸入價格' : 'Price TBC'}
              </span>
            )}
          </div>

          {serviceName && (
            <span className="inline-flex items-center px-2.5 py-0.5 mb-1.5 rounded-full text-xs font-semibold bg-teal-700 text-white">
              {serviceName}
            </span>
          )}

          <div className="text-xs text-muted space-y-0.5">
            <p>{format(parseISO(booking.booking_date), locale === 'zh-HK' ? 'M月d日' : 'MMM d, yyyy')}</p>
            {booking.customer_phone && <p>{booking.customer_phone}</p>}
            {booking.customer_notes && <p className="text-amber-700">{booking.customer_notes}</p>}
          </div>
        </div>

        {/* Action buttons — same row as details */}
        <div className="shrink-0 flex flex-col gap-1.5 justify-center" onClick={(e) => e.stopPropagation()}>
          {needsFinalPrice ? (
            <button
              onClick={onSelect}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-medium hover:bg-amber-600 cursor-pointer whitespace-nowrap"
            >
              <DollarSign size={13} />
              {locale === 'zh-HK' ? '輸入價格' : 'Set Price'}
            </button>
          ) : (
            <button
              onClick={onConfirm}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:opacity-90 cursor-pointer whitespace-nowrap"
            >
              <UserCheck size={13} />
              {locale === 'zh-HK' ? '確認' : 'Confirm'}
            </button>
          )}
          <button
            onClick={() => { if (confirm(t('cancelConfirm'))) onCancel(); }}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-white text-red-600 text-xs font-medium hover:bg-red-50 cursor-pointer whitespace-nowrap"
          >
            <X size={13} />
            {locale === 'zh-HK' ? '拒絕' : 'Decline'}
          </button>
        </div>
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
  onUpdateStatus: (id: string, status: string, extras?: { price_hkd?: number }) => Promise<void>;
  t: ReturnType<typeof useI18n>['t'];
}) {
  const badge = STATUS_BADGE[booking.status];
  const serviceName = booking.service
    ? locale === 'zh-HK' && booking.service.name_zh
      ? booking.service.name_zh
      : booking.service.name
    : null;
  const isTbc = booking.service?.pricing_type === 'tbc';
  const needsFinalPrice = isTbc && booking.price_hkd == null;
  const [finalPrice, setFinalPrice] = useState('');
  const parsedPrice = parseInt(finalPrice, 10);
  const priceValid = !needsFinalPrice || (finalPrice.trim() !== '' && !Number.isNaN(parsedPrice) && parsedPrice >= 0);

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

  const priceValue = booking.price_hkd != null
    ? formatPrice(booking.price_hkd)
    : isTbc
      ? (locale === 'zh-HK' ? '待確認 (需要輸入最終價格)' : 'TBC — enter final price to confirm')
      : null;

  const rows: { label: string; value: string }[] = [
    { label: locale === 'zh-HK' ? '日期' : 'Date', value: format(parseISO(booking.booking_date), 'MMM d, yyyy') },
    { label: locale === 'zh-HK' ? '時間' : 'Time', value: `${formatTime(booking.start_time)} – ${formatTime(booking.end_time)}` },
    ...(serviceName ? [{ label: locale === 'zh-HK' ? '服務' : 'Service', value: serviceName }] : []),
    ...(priceValue ? [{ label: locale === 'zh-HK' ? '價格' : 'Price', value: priceValue }] : []),
    ...(booking.customer_phone ? [{ label: locale === 'zh-HK' ? '電話' : 'Phone', value: booking.customer_phone }] : []),
    ...(booking.customer_whatsapp && booking.customer_whatsapp !== booking.customer_phone ? [{ label: 'WhatsApp', value: booking.customer_whatsapp }] : []),
    ...(booking.customer_email ? [{ label: 'Email', value: booking.customer_email }] : []),
  ];
  const timingAlert = getPendingTimingAlert(booking.booking_date, locale);

  const handleConfirm = () => {
    if (!priceValid) return;
    const extras = needsFinalPrice ? { price_hkd: parsedPrice } : undefined;
    void onUpdateStatus(booking.id, 'confirmed', extras);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between p-6 pb-4 shrink-0">
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

        <div className="px-6 pb-4 space-y-3 overflow-y-auto flex-1">
          {timingAlert && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span className="font-medium">{timingAlert}</span>
            </div>
          )}

          {customerNotesSection.length > 0 && (
            <div className="rounded-xl bg-[#FAFAFB] border border-[#E5E7EB] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280] mb-3">
                {locale === 'zh-HK' ? '客人備注' : 'Customer Notes'}
              </p>
              <div className="space-y-3">
                {customerNotesSection.map((row) => (
                  <div key={row.label} className="space-y-0.5">
                    <p className="text-xs text-muted">{row.label}</p>
                    <p className="text-sm font-medium whitespace-pre-wrap">{row.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {booking.customer_image_url && (
            <div className="rounded-xl bg-[#FAFAFB] border border-[#E5E7EB] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280] mb-3 flex items-center gap-1.5">
                <ImageIcon size={12} />
                {locale === 'zh-HK' ? '客人附圖' : 'Customer Photo'}
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={booking.customer_image_url}
                alt={locale === 'zh-HK' ? '客人上傳圖片' : 'Customer uploaded photo'}
                className="w-full rounded-lg object-cover max-h-72"
              />
            </div>
          )}

          {rows.map((row) => (
            <div key={row.label} className="flex items-start gap-3 text-sm">
              <span className="text-muted w-20 shrink-0">{row.label}</span>
              <span className="font-medium">{row.value}</span>
            </div>
          ))}

          {needsFinalPrice && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-800">
                <DollarSign size={13} />
                {locale === 'zh-HK' ? '輸入最終價格' : 'Enter Final Price'}
              </div>
              <p className="text-xs text-amber-700">
                {locale === 'zh-HK'
                  ? '此服務為待確認價格，請在確認預約前輸入最終金額。'
                  : 'This service is priced on request. Enter the final amount before confirming.'}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-amber-900">HK$</span>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={finalPrice}
                  onChange={(e) => setFinalPrice(e.target.value)}
                  placeholder={locale === 'zh-HK' ? '例如 500' : 'e.g. 500'}
                  className="flex-1 h-10 px-3 rounded-lg border border-amber-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-500"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 px-6 pb-6 pt-2 border-t border-border mt-2">
          <button
            onClick={handleConfirm}
            disabled={!priceValid}
            className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-2 rounded-xl bg-primary text-white hover:opacity-90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <UserCheck size={15} />
            {needsFinalPrice
              ? (locale === 'zh-HK' ? '確認並設定價格' : 'Confirm with Price')
              : t('confirmBookingRequest')}
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
