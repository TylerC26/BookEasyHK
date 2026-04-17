'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n/context';
import type { TranslationKey } from '@/lib/i18n/translations';
import { Card, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { formatPrice, formatTime, addMinutesToTime } from '@/lib/utils';
import type { Booking, Business, Service } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { CalendarCheck, Clock, AlertTriangle, ChevronRight, Plus, X, UserCheck } from 'lucide-react';

const STATUS_BADGE: Record<string, { variant: 'default' | 'success' | 'warning' | 'danger' | 'muted'; label_zh: string; label_en: string }> = {
  pending: { variant: 'warning', label_zh: '待確認', label_en: 'Pending' },
  confirmed: { variant: 'default', label_zh: '已確認', label_en: 'Confirmed' },
  completed: { variant: 'success', label_zh: '已完成', label_en: 'Completed' },
  no_show: { variant: 'danger', label_zh: '爽約', label_en: 'No-Show' },
  cancelled: { variant: 'muted', label_zh: '已取消', label_en: 'Cancelled' },
};

const STATUS_BORDER: Record<string, string> = {
  pending: 'border-amber-400',
  confirmed: 'border-[#0F766E]',
  completed: 'border-emerald-500',
  no_show: 'border-red-500',
  cancelled: 'border-slate-300',
};

export default function DashboardPage() {
  const { t, locale } = useI18n();
  const [business, setBusiness] = useState<Business | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [todayBookings, setTodayBookings] = useState<Booking[]>([]);
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [showManual, setShowManual] = useState(false);
  const [showBlock, setShowBlock] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  // Manual booking form
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualService, setManualService] = useState('');
  const [manualDate, setManualDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [manualTime, setManualTime] = useState('10:00');
  const [manualSubmitting, setManualSubmitting] = useState(false);

  // Block time form
  const [blockDate, setBlockDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [blockStart, setBlockStart] = useState('12:00');
  const [blockEnd, setBlockEnd] = useState('13:00');
  const [blockReason, setBlockReason] = useState('');
  const [blockSubmitting, setBlockSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: biz } = await supabase
      .from('businesses')
      .select('*')
      .eq('owner_id', user.id)
      .single();

    if (!biz) return;
    setBusiness(biz);

    const { data: svc } = await supabase
      .from('services')
      .select('*')
      .eq('business_id', biz.id)
      .eq('active', true)
      .order('sort_order');

    setServices(svc || []);

    const today = format(new Date(), 'yyyy-MM-dd');

    const { data: todayData } = await supabase
      .from('bookings')
      .select('*, service:services(*), booking_answers(*, question:booking_questions(*))')
      .eq('business_id', biz.id)
      .eq('booking_date', today)
      .in('status', ['confirmed', 'completed', 'no_show'])
      .order('start_time');

    setTodayBookings(todayData || []);

    const { data: upcomingData } = await supabase
      .from('bookings')
      .select('*, service:services(*), booking_answers(*, question:booking_questions(*))')
      .eq('business_id', biz.id)
      .gt('booking_date', today)
      .in('status', ['confirmed', 'completed', 'no_show'])
      .order('booking_date')
      .order('start_time')
      .limit(20);

    setUpcomingBookings(upcomingData || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const run = async () => {
      await loadData();
    };

    void run();
  }, [loadData]);

  const updateBookingStatus = async (bookingId: string, status: string) => {
    const supabase = createClient();
    await supabase.from('bookings').update({ status }).eq('id', bookingId);

    // When a booking is cancelled, notify the first person on the waitlist
    // for that slot (fire-and-forget).
    if (status === 'cancelled') {
      const allCurrent = [...todayBookings, ...upcomingBookings];
      const cancelled = allCurrent.find((b) => b.id === bookingId);
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

    loadData();
  };

  const updateBookingAmount = async (bookingId: string, price_hkd: number | null) => {
    const supabase = createClient();
    await supabase.from('bookings').update({ price_hkd }).eq('id', bookingId);

    setSelectedBooking((current) => (
      current && current.id === bookingId
        ? { ...current, price_hkd }
        : current
    ));

    loadData();
  };

  const updateBookingOwnerDetails = async (
    bookingId: string,
    fields: Pick<Booking, 'owner_notes'>
  ) => {
    const supabase = createClient();
    await supabase.from('bookings').update(fields).eq('id', bookingId);

    setSelectedBooking((current) => (
      current && current.id === bookingId
        ? { ...current, ...fields }
        : current
    ));

    loadData();
  };

  const handleManualBooking = async () => {
    if (!business || !manualName || !manualService) return;
    setManualSubmitting(true);

    const supabase = createClient();
    const svc = services.find((s) => s.id === manualService);
    const endTime = svc ? addMinutesToTime(manualTime, svc.duration_minutes) : addMinutesToTime(manualTime, 60);

    await supabase.from('bookings').insert({
      business_id: business.id,
      service_id: manualService || null,
      price_hkd: svc?.price_hkd ?? null,
      customer_name: manualName,
      customer_phone: manualPhone || null,
      booking_date: manualDate,
      start_time: manualTime,
      end_time: endTime,
      status: 'confirmed',
      is_manual: true,
    });

    setShowManual(false);
    setManualName('');
    setManualPhone('');
    setManualSubmitting(false);
    loadData();
  };

  const handleBlockTime = async () => {
    if (!business) return;
    setBlockSubmitting(true);

    const supabase = createClient();
    await supabase.from('blocked_times').insert({
      business_id: business.id,
      blocked_date: blockDate,
      start_time: blockStart,
      end_time: blockEnd,
      reason: blockReason || null,
    });

    setShowBlock(false);
    setBlockReason('');
    setBlockSubmitting(false);
  };

  const zh = locale === 'zh-HK';

  // Revenue estimate from confirmed/completed bookings
  const allBookings = [...todayBookings, ...upcomingBookings];
  const revenueEstimate = allBookings.reduce((sum, b) => {
    const price = b.price_hkd ?? (b.service as Service | null)?.price_hkd ?? 0;
    return sum + (b.status !== 'cancelled' ? price : 0);
  }, 0);

  const noShowCount = todayBookings.filter((b) => b.status === 'no_show').length;
  const noShowRate = todayBookings.length > 0
    ? Math.round((noShowCount / todayBookings.length) * 100)
    : 0;

  const stats = {
    today: todayBookings.length,
    revenue: revenueEstimate,
    noShowRate,
    upcoming: upcomingBookings.length,
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted">{t('loading')}</div>;
  }

  const today = new Date();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#111111]">
            {business?.name ? `${business.name}` : t('dashboard')}
          </h1>
          <p className="text-xs text-[#6B7280] mt-0.5">
            {format(today, zh ? 'yyyy年M月d日 EEEE' : 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="whitespace-nowrap" onClick={() => setShowBlock(true)}>
            {t('blockTime')}
          </Button>
          <Button size="sm" className="whitespace-nowrap" onClick={() => setShowManual(true)}>
            <Plus size={16} /> {t('manualBooking')}
          </Button>
        </div>
      </div>

      {/* Stats — 4-column */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <p className="text-xs text-[#6B7280] mb-1">{t('todayCount')}</p>
          <p className="text-3xl font-bold text-[#111111]">{stats.today}</p>
          <p className="text-xs text-[#0F766E] mt-1">↑ 2 {zh ? '高於平均' : 'vs avg'}</p>
        </Card>
        <Card>
          <p className="text-xs text-[#6B7280] mb-1">{zh ? '收入估算' : 'Est. Revenue'}</p>
          <p className="text-3xl font-bold text-[#111111]">
            {stats.revenue > 0 ? `$${(stats.revenue / 1000).toFixed(0)}k` : '$0'}
          </p>
          <p className="text-xs text-[#0F766E] mt-1">↑ 12%</p>
        </Card>
        <Card>
          <p className="text-xs text-[#6B7280] mb-1">{t('noShowRate')}</p>
          <p className="text-3xl font-bold text-[#111111]">{stats.noShowRate}%</p>
          <p className="text-xs text-red-500 mt-1">↓ 3%</p>
        </Card>
        <Card>
          <p className="text-xs text-[#6B7280] mb-1">{t('upcoming')}</p>
          <p className="text-3xl font-bold text-[#111111]">{stats.upcoming}</p>
          <div className="flex gap-0.5 mt-1">
            {Array.from({ length: Math.min(stats.upcoming, 5) }).map((_, i) => (
              <div key={i} className="w-3 h-1.5 rounded-full bg-[#0F766E]" />
            ))}
          </div>
        </Card>
      </div>

      {/* Today's Schedule */}
      <Card>
        <CardTitle className="mb-4">{t('todaySchedule')}</CardTitle>
        {todayBookings.length === 0 ? (
          <div className="text-center py-8 text-muted">
            <CalendarCheck size={32} className="mx-auto mb-2 opacity-40" />
            <p>{t('noBookingsToday')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {todayBookings.map((booking) => (
              <BookingRow
                key={booking.id}
                booking={booking}
                locale={locale}
                onUpdateStatus={updateBookingStatus}
                onSelect={setSelectedBooking}
                t={t}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Upcoming */}
      <Card>
        <CardTitle className="mb-4">{t('upcoming')}</CardTitle>
        {upcomingBookings.length === 0 ? (
          <div className="text-center py-8 text-muted">
            <Clock size={32} className="mx-auto mb-2 opacity-40" />
            <p>{t('noUpcoming')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingBookings.map((booking) => (
              <BookingRow
                key={booking.id}
                booking={booking}
                locale={locale}
                showDate
                onUpdateStatus={updateBookingStatus}
                onSelect={setSelectedBooking}
                t={t}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Booking Detail Modal */}
      {selectedBooking && (
        <BookingDetailModal
          booking={selectedBooking}
          locale={locale}
          onClose={() => setSelectedBooking(null)}
          onUpdateStatus={(id, status) => { updateBookingStatus(id, status); setSelectedBooking(null); }}
          onUpdateAmount={updateBookingAmount}
          onUpdateOwnerDetails={updateBookingOwnerDetails}
          t={t}
        />
      )}

      {/* Manual Booking Modal */}
      {showManual && (
        <Modal onClose={() => setShowManual(false)} title={t('manualBooking')}>
          <div className="space-y-4">
            <Input
              id="manual-name"
              label={t('customerName')}
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              required
            />
            <Input
              id="manual-phone"
              label={t('phoneNumber')}
              type="tel"
              value={manualPhone}
              onChange={(e) => setManualPhone(e.target.value)}
            />
            <Select
              id="manual-service"
              label={t('service')}
              value={manualService}
              onChange={(e) => setManualService(e.target.value)}
              options={[
                { value: '', label: locale === 'zh-HK' ? '選擇服務' : 'Select service' },
                ...services.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
            <Input
              id="manual-date"
              label={t('date')}
              type="date"
              value={manualDate}
              onChange={(e) => setManualDate(e.target.value)}
            />
            <Input
              id="manual-time"
              label={t('time')}
              type="time"
              value={manualTime}
              onChange={(e) => setManualTime(e.target.value)}
            />
            <Button className="w-full" onClick={handleManualBooking} loading={manualSubmitting} disabled={!manualName}>
              {t('confirm')}
            </Button>
          </div>
        </Modal>
      )}

      {/* Block Time Modal */}
      {showBlock && (
        <Modal onClose={() => setShowBlock(false)} title={t('blockTime')}>
          <div className="space-y-4">
            <Input
              id="block-date"
              label={t('date')}
              type="date"
              value={blockDate}
              onChange={(e) => setBlockDate(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                id="block-start"
                label={t('openTime')}
                type="time"
                value={blockStart}
                onChange={(e) => setBlockStart(e.target.value)}
              />
              <Input
                id="block-end"
                label={t('closeTime')}
                type="time"
                value={blockEnd}
                onChange={(e) => setBlockEnd(e.target.value)}
              />
            </div>
            <Input
              id="block-reason"
              label={locale === 'zh-HK' ? '原因（選填）' : 'Reason (optional)'}
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
            />
            <Button className="w-full" onClick={handleBlockTime} loading={blockSubmitting}>
              {t('confirm')}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function BookingRow({
  booking,
  locale,
  showDate,
  onUpdateStatus,
  onSelect,
  t,
}: {
  booking: Booking;
  locale: string;
  showDate?: boolean;
  onUpdateStatus: (id: string, status: string) => void;
  onSelect: (booking: Booking) => void;
  t: (key: TranslationKey) => string;
}) {
  const badge = STATUS_BADGE[booking.status];
  const serviceName = booking.service
    ? locale === 'zh-HK' && booking.service.name_zh
      ? booking.service.name_zh
      : booking.service.name
    : '';
  const displayPrice = booking.price_hkd ?? booking.service?.price_hkd ?? null;

  return (
    <div
      className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors"
      onClick={() => onSelect(booking)}
    >
      {/* Time column */}
      <div className="w-14 shrink-0 flex flex-col items-end gap-1 pt-0.5">
        <span className="text-xs font-semibold text-on-surface leading-none">{formatTime(booking.start_time)}</span>
        <div className="w-px h-3 bg-border self-center" />
        <span className="text-xs text-muted leading-none">{formatTime(booking.end_time)}</span>
      </div>

      {/* Content with coloured left border */}
      <div className={`flex-1 min-w-0 border-l-2 pl-3 ${STATUS_BORDER[booking.status]}`}>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-base truncate">{booking.customer_name}</span>
          {showDate && <span className="text-xs text-muted shrink-0">{format(parseISO(booking.booking_date), 'MMM d')}</span>}
          {booking.customer_phone && (
            <span className="text-xs text-muted truncate hidden sm:inline">{booking.customer_phone}</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {serviceName && <span className="text-xs text-muted">{serviceName}</span>}
          {displayPrice !== null && <Badge variant="default">{formatPrice(displayPrice)}</Badge>}
          {booking.is_manual && <Badge variant="muted">{locale === 'zh-HK' ? '手動' : 'Manual'}</Badge>}
          {booking.customer_notes && <Badge variant="warning">{locale === 'zh-HK' ? '有備注' : 'Has Notes'}</Badge>}
          {booking.owner_notes && <Badge variant="muted">{locale === 'zh-HK' ? '店主備注' : 'Owner Note'}</Badge>}
          <Badge variant={badge.variant}>{locale === 'zh-HK' ? badge.label_zh : badge.label_en}</Badge>
        </div>
      </div>

      {/* Actions */}
      {booking.status === 'confirmed' && (
        <>
          <div className="flex sm:hidden ml-1 text-muted shrink-0" aria-hidden="true">
            <ChevronRight size={18} />
          </div>
          <div className="hidden sm:flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="sm" onClick={() => onUpdateStatus(booking.id, 'completed')} title={t('markDone')}>
              <UserCheck size={16} className="text-emerald-600" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onUpdateStatus(booking.id, 'no_show')} title={t('markNoShow')}>
              <AlertTriangle size={16} className="text-amber-500" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { if (confirm(t('cancelConfirm'))) onUpdateStatus(booking.id, 'cancelled'); }} title={t('cancelBooking')}>
              <X size={16} className="text-red-500" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function BookingDetailModal({
  booking,
  locale,
  onClose,
  onUpdateStatus,
  onUpdateAmount,
  onUpdateOwnerDetails,
  t,
}: {
  booking: Booking;
  locale: string;
  onClose: () => void;
  onUpdateStatus: (id: string, status: string) => void;
  onUpdateAmount: (id: string, price_hkd: number | null) => Promise<void>;
  onUpdateOwnerDetails: (
    bookingId: string,
    fields: Pick<Booking, 'owner_notes'>
  ) => Promise<void>;
  t: (key: TranslationKey) => string;
}) {
  const badge = STATUS_BADGE[booking.status];
  const serviceName = booking.service
    ? locale === 'zh-HK' && booking.service.name_zh
      ? booking.service.name_zh
      : booking.service.name
    : null;
  const [priceInput, setPriceInput] = useState(
    booking.price_hkd ?? booking.service?.price_hkd ?? null
  );
  const [savingAmount, setSavingAmount] = useState(false);
  const [ownerNotes, setOwnerNotes] = useState(booking.owner_notes ?? '');
  const [savingOwnerDetails, setSavingOwnerDetails] = useState(false);

  useEffect(() => {
    setPriceInput(booking.price_hkd ?? booking.service?.price_hkd ?? null);
    setOwnerNotes(booking.owner_notes ?? '');
  }, [booking]);

  const rows: { label: string; value: string }[] = [
    { label: locale === 'zh-HK' ? '日期' : 'Date', value: format(parseISO(booking.booking_date), 'MMM d, yyyy') },
    { label: locale === 'zh-HK' ? '時間' : 'Time', value: `${formatTime(booking.start_time)} – ${formatTime(booking.end_time)}` },
    ...(serviceName ? [{ label: t('service'), value: serviceName }] : []),
    ...(booking.customer_phone ? [{ label: t('phoneNumber'), value: booking.customer_phone }] : []),
    ...(booking.customer_whatsapp && booking.customer_whatsapp !== booking.customer_phone ? [{ label: 'WhatsApp', value: booking.customer_whatsapp }] : []),
    ...(booking.customer_email ? [{ label: 'Email', value: booking.customer_email }] : []),
  ];
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

  const saveAmount = async () => {
    setSavingAmount(true);
    try {
      await onUpdateAmount(booking.id, priceInput);
    } finally {
      setSavingAmount(false);
    }
  };

  const saveOwnerDetails = async () => {
    setSavingOwnerDetails(true);

    try {
      await onUpdateOwnerDetails(booking.id, {
        owner_notes: ownerNotes.trim() || null,
      });
    } finally {
      setSavingOwnerDetails(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between p-6 pb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-semibold">{booking.customer_name}</h3>
              {booking.is_manual && (
                <Badge variant="muted">{locale === 'zh-HK' ? '手動' : 'Manual'}</Badge>
              )}
              <Badge variant={badge.variant}>
                {locale === 'zh-HK' ? badge.label_zh : badge.label_en}
              </Badge>
            </div>
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

          <div className="pt-2 border-t border-border">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Input
                  id={`booking-price-${booking.id}`}
                  label={t('price')}
                  type="number"
                  min="0"
                  step="1"
                  value={priceInput ?? ''}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    setPriceInput(nextValue === '' ? null : parseInt(nextValue, 10) || 0);
                  }}
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={saveAmount}
                loading={savingAmount}
              >
                {locale === 'zh-HK' ? '更新金額' : 'Update Amount'}
              </Button>
            </div>
          </div>

          <div className="pt-2 border-t border-border space-y-3">
            <div className="space-y-1.5">
              <label htmlFor={`booking-owner-notes-${booking.id}`} className="block text-xs font-medium text-[#3D3D3D]">
                {locale === 'zh-HK' ? '店主備注' : 'Owner Notes'}
              </label>
              <textarea
                id={`booking-owner-notes-${booking.id}`}
                value={ownerNotes}
                onChange={(e) => setOwnerNotes(e.target.value)}
                rows={3}
                placeholder={locale === 'zh-HK' ? '加入內部備注...' : 'Add internal notes...'}
                className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-sm text-[#111111] placeholder:text-[#D1D5DB] transition-colors focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] resize-none"
              />
            </div>

            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={saveOwnerDetails}
                loading={savingOwnerDetails}
              >
                {locale === 'zh-HK' ? '儲存備注' : 'Save Notes'}
              </Button>
            </div>
          </div>
        </div>

        {booking.status === 'confirmed' && (
          <div className="flex gap-2 px-6 pb-6 pt-2 border-t border-border mt-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => onUpdateStatus(booking.id, 'completed')}
            >
              <UserCheck size={15} className="text-emerald-600" />
              {locale === 'zh-HK' ? '完成' : 'Done'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => onUpdateStatus(booking.id, 'no_show')}
            >
              <AlertTriangle size={15} className="text-amber-500" />
              {locale === 'zh-HK' ? '爽約' : 'No-Show'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => {
                if (confirm(t('cancelConfirm'))) onUpdateStatus(booking.id, 'cancelled');
              }}
            >
              <X size={15} className="text-red-500" />
              {locale === 'zh-HK' ? '取消' : 'Cancel'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-muted hover:text-secondary cursor-pointer">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
