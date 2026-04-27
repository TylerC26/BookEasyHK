'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n/context';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatPrice, formatTime } from '@/lib/utils';
import type { Booking } from '@/lib/types';
import { differenceInCalendarDays, format, parseISO, startOfToday } from 'date-fns';
import {
  AlertTriangle,
  DollarSign,
  ImageIcon,
  Inbox,
  UserCheck,
  X,
  ArrowRight,
  Clock,
  ChevronRight,
  Phone,
  Mail,
  MessageCircle,
} from 'lucide-react';

const STATUS_BADGE: Record<string, { variant: 'default' | 'success' | 'warning' | 'danger' | 'muted'; label_zh: string; label_en: string }> = {
  pending: { variant: 'warning', label_zh: '待確認', label_en: 'Pending' },
  confirmed: { variant: 'default', label_zh: '已確認', label_en: 'Confirmed' },
  completed: { variant: 'success', label_zh: '已完成', label_en: 'Completed' },
  no_show: { variant: 'danger', label_zh: '爽約', label_en: 'No-Show' },
  cancelled: { variant: 'muted', label_zh: '已取消', label_en: 'Cancelled' },
};

type Urgency = 'overdue' | 'today' | 'tomorrow' | 'scheduled';

function urgencyOf(bookingDate: string): Urgency {
  const days = differenceInCalendarDays(parseISO(bookingDate), startOfToday());
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return 'scheduled';
}

function urgencyAlert(bookingDate: string, zh: boolean): string | null {
  const u = urgencyOf(bookingDate);
  if (u === 'overdue') return zh ? '預約日期已過，仍未確認' : 'Date has passed, still unconfirmed';
  if (u === 'today') return zh ? '今日預約，仍未確認' : 'Today and unconfirmed';
  if (u === 'tomorrow') return zh ? '明日預約，仍未確認' : 'Tomorrow and unconfirmed';
  return null;
}

const URGENCY_LABEL: Record<Urgency, { zh: string; en: string }> = {
  overdue: { zh: '逾期', en: 'Overdue' },
  today: { zh: '今日', en: 'Today' },
  tomorrow: { zh: '明日', en: 'Tomorrow' },
  scheduled: { zh: '稍後', en: 'Scheduled' },
};

const URGENCY_COLOR: Record<Urgency, string> = {
  overdue: '#EF4444',
  today: '#D97706',
  tomorrow: '#F59E0B',
  scheduled: '#0F766E',
};

export default function PendingRequestsPage() {
  const { t, locale } = useI18n();
  const zh = locale === 'zh-HK';

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [nowMs, setNowMs] = useState(0);

  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

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
      .order('booking_date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(100);

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

  const grouped = useMemo(() => {
    const g: Record<Urgency, Booking[]> = { overdue: [], today: [], tomorrow: [], scheduled: [] };
    for (const b of bookings) g[urgencyOf(b.booking_date)].push(b);
    return g;
  }, [bookings]);

  const needsPrice = useMemo(
    () => bookings.filter((b) => b.service?.pricing_type === 'tbc' && b.price_hkd == null).length,
    [bookings]
  );

  const oldestHours = useMemo(() => {
    if (bookings.length === 0 || nowMs === 0) return 0;
    const oldest = bookings.reduce((acc, b) => {
      const t = new Date(b.created_at).getTime();
      return t < acc ? t : acc;
    }, nowMs);
    return Math.max(0, Math.round((nowMs - oldest) / 3_600_000));
  }, [bookings, nowMs]);

  const sectionsOrder: Urgency[] = ['overdue', 'today', 'tomorrow', 'scheduled'];

  return (
    <div className="space-y-7">
      {/* ── HEADER ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between animate-fade-up">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#9CA3AF] mb-1">
            {zh ? '收件匣' : 'Inbox'} ·{' '}
            <span className="text-[#6B7280]">
              {bookings.length === 0
                ? (zh ? '空空如也' : 'all caught up')
                : (zh ? `${bookings.length} 個待處理` : `${bookings.length} awaiting review`)}
            </span>
          </p>
          <h1 className="font-display text-[28px] md:text-[34px] leading-[1.05] font-light text-[#111111]">
            {t('bookingRequests')}<span className="text-[#0F766E]">.</span>
          </h1>
          <p className="text-sm text-[#6B7280] mt-1.5 max-w-xl">{t('pendingReviewHint')}</p>
        </div>
      </div>

      {/* ── KPI STRIP ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-up" style={{ animationDelay: '60ms' }}>
        <KpiCard
          eyebrow={zh ? '逾期' : 'Overdue'}
          value={grouped.overdue.length}
          tone="danger"
          hint={zh ? '日期已過' : 'Past due'}
        />
        <KpiCard
          eyebrow={zh ? '今日' : 'Today'}
          value={grouped.today.length}
          tone="warning"
          hint={zh ? '今天到期' : 'Need decision'}
        />
        <KpiCard
          eyebrow={zh ? '需定價' : 'Needs Price'}
          value={needsPrice}
          tone="amber"
          hint={zh ? '待輸入金額' : 'TBC pricing'}
        />
        <KpiCard
          eyebrow={zh ? '最早等待' : 'Oldest'}
          value={oldestHours}
          suffix={zh ? '小時' : 'h'}
          tone={oldestHours > 24 ? 'danger' : 'neutral'}
          hint={zh ? '客人等待時間' : 'Wait time'}
        />
      </div>

      {/* ── BODY ────────────────────────────────────────────────── */}
      {loading ? (
        <Card className="p-12">
          <div className="text-center text-[#9CA3AF] text-sm">{t('loading')}</div>
        </Card>
      ) : bookings.length === 0 ? (
        <Card className="relative overflow-hidden p-12 animate-fade-up" style={{ animationDelay: '120ms' }}>
          <DotPattern />
          <div className="relative text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#0F766E]/10 mb-4">
              <Inbox size={26} className="text-[#0F766E]" />
            </div>
            <p className="font-display text-2xl font-light text-[#111111]">
              {zh ? '收件匣已清空' : 'Inbox zero.'}
            </p>
            <p className="text-sm text-[#6B7280] mt-1.5">{t('noPendingBookings')}</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-7 animate-fade-up" style={{ animationDelay: '120ms' }}>
          {sectionsOrder.map((u) => {
            const group = grouped[u];
            if (group.length === 0) return null;
            return (
              <UrgencySection key={u} urgency={u} bookings={group} zh={zh}>
                <div className="space-y-2.5">
                  {group.map((booking) => (
                    <PendingRequestCard
                      key={booking.id}
                      booking={booking}
                      locale={locale}
                      nowMs={nowMs}
                      onConfirm={() => updateStatus(booking.id, 'confirmed')}
                      onCancel={() => updateStatus(booking.id, 'cancelled')}
                      onSelect={() => setSelectedBooking(booking)}
                      t={t}
                    />
                  ))}
                </div>
              </UrgencySection>
            );
          })}
        </div>
      )}

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

// ── KPI CARD ─────────────────────────────────────────────────────────────────

function KpiCard({
  eyebrow,
  value,
  suffix,
  hint,
  tone,
}: {
  eyebrow: string;
  value: number;
  suffix?: string;
  hint?: string;
  tone: 'danger' | 'warning' | 'amber' | 'neutral';
}) {
  const accent =
    tone === 'danger' ? '#EF4444' :
    tone === 'warning' ? '#D97706' :
    tone === 'amber' ? '#F59E0B' :
    '#0F766E';
  const dim = value === 0 && tone !== 'neutral';

  return (
    <Card className="relative overflow-hidden p-5">
      <div className="flex items-start justify-between">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF] font-medium">
          {eyebrow}
        </p>
        <span
          className="w-1.5 h-1.5 rounded-full mt-1.5"
          style={{ background: dim ? '#E5E7EB' : accent }}
        />
      </div>
      <div className="flex items-baseline gap-1.5 mt-2">
        <span
          className="font-display text-[40px] leading-none font-light tabular-nums"
          style={{ color: dim ? '#D1D5DB' : '#111111' }}
        >
          {value}
        </span>
        {suffix && (
          <span className="text-xs text-[#6B7280] font-medium">{suffix}</span>
        )}
      </div>
      {hint && (
        <p className="text-[11px] text-[#9CA3AF] mt-2 tracking-wide">{hint}</p>
      )}
    </Card>
  );
}

// ── URGENCY SECTION ──────────────────────────────────────────────────────────

function UrgencySection({
  urgency,
  bookings,
  zh,
  children,
}: {
  urgency: Urgency;
  bookings: Booking[];
  zh: boolean;
  children: React.ReactNode;
}) {
  const label = zh ? URGENCY_LABEL[urgency].zh : URGENCY_LABEL[urgency].en;
  const color = URGENCY_COLOR[urgency];

  return (
    <section>
      <div className="flex items-baseline gap-3 mb-3">
        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
        <h2 className="font-display text-[18px] font-light text-[#111111] tracking-tight">
          {label}
        </h2>
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#9CA3AF] tabular-nums">
          {bookings.length}
        </span>
        <span className="flex-1 h-px bg-[#E5E7EB]" />
      </div>
      {children}
    </section>
  );
}

// ── PENDING REQUEST CARD ─────────────────────────────────────────────────────

function PendingRequestCard({
  booking,
  locale,
  nowMs,
  onConfirm,
  onCancel,
  onSelect,
  t,
}: {
  booking: Booking;
  locale: string;
  nowMs: number;
  onConfirm: () => void;
  onCancel: () => void;
  onSelect: () => void;
  t: ReturnType<typeof useI18n>['t'];
}) {
  const zh = locale === 'zh-HK';
  const serviceName = booking.service
    ? zh && booking.service.name_zh
      ? booking.service.name_zh
      : booking.service.name
    : null;
  const u = urgencyOf(booking.booking_date);
  const alert = urgencyAlert(booking.booking_date, zh);
  const needsFinalPrice = booking.service?.pricing_type === 'tbc' && booking.price_hkd == null;
  const accent = URGENCY_COLOR[u];
  const displayPrice = booking.price_hkd ?? booking.service?.price_hkd ?? null;

  const waitedH = nowMs === 0
    ? 0
    : Math.max(0, Math.round((nowMs - new Date(booking.created_at).getTime()) / 3_600_000));
  const waitedLabel =
    nowMs === 0 ? '' :
    waitedH < 1 ? (zh ? '剛剛' : 'just now') :
    waitedH < 24 ? (zh ? `${waitedH}小時前` : `${waitedH}h ago`) :
    (zh ? `${Math.floor(waitedH / 24)}天前` : `${Math.floor(waitedH / 24)}d ago`);

  return (
    <div
      onClick={onSelect}
      className="relative bg-white rounded-xl border border-[#E5E7EB] hover:border-[#0F766E]/40 hover:shadow-sm transition-all cursor-pointer overflow-hidden"
    >
      {/* status edge */}
      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: accent }} />

      <div className="pl-5 pr-4 py-4 flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4">
        {/* TIME */}
        <div className="flex items-center gap-3 lg:w-[180px] lg:shrink-0">
          <div className="text-center">
            <div className="font-display text-[24px] leading-none font-light text-[#111111] tabular-nums">
              {format(parseISO(booking.booking_date), 'd')}
            </div>
            <div className="text-[10px] uppercase tracking-[0.15em] text-[#9CA3AF] mt-0.5">
              {format(parseISO(booking.booking_date), zh ? 'M月' : 'MMM')}
            </div>
          </div>
          <div className="h-10 w-px bg-[#E5E7EB]" />
          <div>
            <div className="text-sm font-semibold text-[#111111] tabular-nums leading-none">
              {formatTime(booking.start_time)}
            </div>
            <div className="text-[11px] text-[#9CA3AF] tabular-nums leading-none mt-1">
              → {formatTime(booking.end_time)}
            </div>
          </div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-[15px] text-[#111111] truncate">
              {booking.customer_name}
            </span>
            {waitedLabel && (
              <span className="text-[11px] text-[#9CA3AF] flex items-center gap-1 shrink-0">
                <Clock size={10} /> {waitedLabel}
              </span>
            )}
            {booking.customer_image_url && (
              <span className="inline-flex items-center gap-1 text-[10px] text-[#7C3AED] bg-[#F5F3FF] border border-[#DDD6FE] px-1.5 py-0.5 rounded-full">
                <ImageIcon size={10} />
                {zh ? '附圖' : 'Photo'}
              </span>
            )}
            {needsFinalPrice && (
              <span className="inline-flex items-center gap-1 text-[10px] text-[#92400E] bg-[#FEF3C7] border border-[#FDE68A] px-1.5 py-0.5 rounded-full">
                <DollarSign size={10} />
                {zh ? '需定價' : 'Set price'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap text-[12px] text-[#6B7280]">
            {serviceName && (
              <span className="text-[#3D3D3D]">{serviceName}</span>
            )}
            {displayPrice !== null && (
              <span className="text-[#0F766E] font-medium">{formatPrice(displayPrice)}</span>
            )}
            {booking.customer_phone && (
              <span className="hidden sm:inline">· {booking.customer_phone}</span>
            )}
          </div>

          {alert && (
            <div className="inline-flex items-center gap-1.5 mt-2 text-[11px] font-medium" style={{ color: accent }}>
              <AlertTriangle size={11} />
              {alert}
            </div>
          )}

          {booking.customer_notes && (
            <p className="text-[12px] text-[#6B7280] italic mt-1.5 line-clamp-1 border-l-2 border-[#E5E7EB] pl-2">
              &ldquo;{booking.customer_notes}&rdquo;
            </p>
          )}
        </div>

        {/* ACTIONS */}
        <div className="flex gap-2 shrink-0 lg:w-auto" onClick={(e) => e.stopPropagation()}>
          {needsFinalPrice ? (
            <button
              onClick={onSelect}
              className="flex-1 lg:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#D97706] text-white text-xs font-medium hover:bg-[#B45309] transition-colors cursor-pointer whitespace-nowrap"
            >
              <DollarSign size={13} />
              {zh ? '定價並確認' : 'Set Price'}
            </button>
          ) : (
            <button
              onClick={onConfirm}
              className="flex-1 lg:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0F766E] text-white text-xs font-medium hover:bg-[#0D9488] transition-colors cursor-pointer whitespace-nowrap"
            >
              <UserCheck size={13} />
              {zh ? '確認' : 'Confirm'}
            </button>
          )}
          <button
            onClick={() => { if (confirm(t('cancelConfirm'))) onCancel(); }}
            className="lg:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[#E5E7EB] text-[#6B7280] text-xs font-medium hover:border-red-300 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            <X size={13} />
            <span className="hidden sm:inline">{zh ? '拒絕' : 'Decline'}</span>
          </button>
          <button
            onClick={onSelect}
            className="hidden lg:inline-flex items-center justify-center w-8 h-8 rounded-lg text-[#9CA3AF] hover:text-[#111111] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
            aria-label="open"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── DOT PATTERN (empty state) ────────────────────────────────────────────────

function DotPattern() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 opacity-[0.4] pointer-events-none"
      style={{
        backgroundImage: 'radial-gradient(#E5E7EB 1px, transparent 1px)',
        backgroundSize: '14px 14px',
        maskImage: 'radial-gradient(circle at center, black, transparent 75%)',
        WebkitMaskImage: 'radial-gradient(circle at center, black, transparent 75%)',
      }}
    />
  );
}

// ── DETAIL MODAL ─────────────────────────────────────────────────────────────

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
  const zh = locale === 'zh-HK';
  const badge = STATUS_BADGE[booking.status];
  const u = urgencyOf(booking.booking_date);
  const accent = URGENCY_COLOR[u];
  const serviceName = booking.service
    ? zh && booking.service.name_zh
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
      ? [{ label: zh ? '客人備注' : 'Customer Note', value: booking.customer_notes }]
      : []),
    ...((booking.booking_answers || [])
      .filter((answer) => answer.answer_text?.trim())
      .map((answer) => ({
        label: answer.question?.question_text || (zh ? '附加問題' : 'Booking Question'),
        value: answer.answer_text,
      }))),
  ];

  const date = parseISO(booking.booking_date);
  const duration = booking.service?.duration_minutes;
  const alert = urgencyAlert(booking.booking_date, zh);
  const priceLabel = booking.price_hkd != null
    ? formatPrice(booking.price_hkd)
    : isTbc
      ? (zh ? '待定' : 'TBC')
      : null;

  const handleConfirm = () => {
    if (!priceValid) return;
    const extras = needsFinalPrice ? { price_hkd: parsedPrice } : undefined;
    void onUpdateStatus(booking.id, 'confirmed', extras);
  };

  return (
    <div className="fixed inset-0 bg-black/55 backdrop-blur-[2px] flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1 w-full shrink-0" style={{ background: accent }} />

        {/* HERO */}
        <div className="relative px-6 pt-6 pb-5 shrink-0">
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.4] pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(#E5E7EB 1px, transparent 1px)',
              backgroundSize: '14px 14px',
              maskImage: 'radial-gradient(circle at top right, black, transparent 65%)',
              WebkitMaskImage: 'radial-gradient(circle at top right, black, transparent 65%)',
            }}
          />
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full text-[#9CA3AF] hover:text-[#111111] hover:bg-[#F3F4F6] transition-colors cursor-pointer flex items-center justify-center z-10"
          >
            <X size={16} />
          </button>

          <div className="relative">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#9CA3AF] font-medium mb-3">
              {zh ? '預約請求' : 'Booking · Request'}
            </p>
            <div className="flex items-end gap-5">
              <div className="text-center shrink-0">
                <div className="font-display text-[56px] leading-[0.9] font-light tabular-nums" style={{ color: u === 'overdue' ? '#EF4444' : '#111111' }}>
                  {format(date, 'd')}
                </div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#9CA3AF] mt-1">
                  {format(date, zh ? 'M月' : 'MMM')}
                </div>
              </div>
              <div className="h-14 w-px bg-[#E5E7EB]" />
              <div className="min-w-0 pb-1">
                <p className="text-[10px] uppercase tracking-[0.18em] text-[#9CA3AF] mb-1">
                  {format(date, 'EEEE')}
                </p>
                <div className="font-display text-xl font-light text-[#111111] leading-tight tabular-nums">
                  {formatTime(booking.start_time)} <span className="text-[#9CA3AF]">→</span> {formatTime(booking.end_time)}
                </div>
                {duration && (
                  <p className="text-[11px] text-[#9CA3AF] mt-1 inline-flex items-center gap-1">
                    <Clock size={11} /> {duration} {zh ? '分鐘' : 'min'}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-dashed border-[#E5E7EB] flex items-baseline gap-2 flex-wrap">
              <h3 className="font-display text-2xl font-light text-[#111111]">
                {booking.customer_name}
              </h3>
              <Badge variant={badge.variant}>
                {zh ? badge.label_zh : badge.label_en}
              </Badge>
            </div>
          </div>
        </div>

        {/* BODY */}
        <div className="px-6 pb-5 space-y-4 overflow-y-auto flex-1">
          {/* URGENCY ALERT */}
          {alert && (
            <div
              className="flex items-start gap-2.5 rounded-xl p-3.5 text-sm"
              style={{
                background: `${accent}10`,
                border: `1px solid ${accent}40`,
                color: accent,
              }}
            >
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span className="font-medium">{alert}</span>
            </div>
          )}

          {/* CONTACT RAIL */}
          {(booking.customer_phone || booking.customer_whatsapp || booking.customer_email) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {booking.customer_phone && (
                <ContactChip
                  href={`tel:${booking.customer_phone}`}
                  icon={<Phone size={12} />}
                  label={zh ? '電話' : 'Phone'}
                  value={booking.customer_phone}
                />
              )}
              {booking.customer_whatsapp && booking.customer_whatsapp !== booking.customer_phone && (
                <ContactChip
                  href={`https://wa.me/${booking.customer_whatsapp.replace(/[^\d]/g, '')}`}
                  icon={<MessageCircle size={12} />}
                  label="WhatsApp"
                  value={booking.customer_whatsapp}
                />
              )}
              {booking.customer_email && (
                <ContactChip
                  href={`mailto:${booking.customer_email}`}
                  icon={<Mail size={12} />}
                  label="Email"
                  value={booking.customer_email}
                />
              )}
            </div>
          )}

          {/* SERVICE + PRICE */}
          {(serviceName || priceLabel) && (
            <div className="rounded-xl border border-[#E5E7EB] bg-gradient-to-br from-white to-[#FAFAF8] p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF] mb-1">
                  {zh ? '服務' : 'Service'}
                </p>
                <p className="font-medium text-[15px] text-[#111111] truncate">
                  {serviceName || (zh ? '未指定' : 'Unspecified')}
                </p>
              </div>
              {priceLabel && (
                <div className="text-right shrink-0">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF] mb-1">
                    {zh ? '價格' : 'Price'}
                  </p>
                  <p className={`font-display font-light text-2xl leading-none tabular-nums ${
                    booking.price_hkd != null ? 'text-[#0F766E]' : 'text-[#9CA3AF]'
                  }`}>
                    {priceLabel}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* CUSTOMER NOTES — pull-quote */}
          {customerNotesSection.length > 0 && (
            <div className="relative rounded-xl bg-[#FAFAF8] border border-[#E5E7EB] p-4 pl-5">
              <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl bg-[#0F766E]" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6B7280] mb-3 flex items-center gap-1.5">
                <span className="font-display text-[#0F766E] text-base leading-none">&ldquo;</span>
                {zh ? '客人備注' : 'Customer Notes'}
              </p>
              <div className="space-y-3">
                {customerNotesSection.map((row, i) => (
                  <div
                    key={row.label}
                    className={`space-y-1 ${i > 0 ? 'pt-3 border-t border-dashed border-[#E5E7EB]' : ''}`}
                  >
                    <p className="text-[11px] uppercase tracking-wider text-[#9CA3AF]">{row.label}</p>
                    <p className="text-sm text-[#111111] whitespace-pre-wrap leading-relaxed">{row.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PHOTO */}
          {booking.customer_image_url && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9CA3AF] mb-2 flex items-center gap-1.5">
                <ImageIcon size={11} />
                {zh ? '客人附圖' : 'Customer Photo'}
              </p>
              <div className="rounded-xl border border-[#E5E7EB] p-1.5 bg-white shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={booking.customer_image_url}
                  alt={zh ? '客人上傳圖片' : 'Customer uploaded photo'}
                  className="w-full rounded-lg object-cover max-h-72"
                />
              </div>
            </div>
          )}

          {/* TBC FINAL PRICE */}
          {needsFinalPrice && (
            <div className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/50 p-4 space-y-2.5">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-800">
                <DollarSign size={13} />
                {zh ? '輸入最終價格' : 'Enter Final Price'}
              </div>
              <p className="text-xs text-amber-700">
                {zh
                  ? '此服務為待確認價格，請在確認預約前輸入最終金額。'
                  : 'This service is priced on request. Enter the final amount before confirming.'}
              </p>
              <div className="flex items-center gap-2">
                <span className="font-display text-lg font-light text-amber-900 tabular-nums">HK$</span>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={finalPrice}
                  onChange={(e) => setFinalPrice(e.target.value)}
                  placeholder={zh ? '例如 500' : 'e.g. 500'}
                  className="flex-1 h-10 px-3 rounded-lg border border-amber-300 bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="flex gap-2 px-6 py-4 border-t border-[#E5E7EB] bg-[#FAFAF8] shrink-0">
          <button
            onClick={handleConfirm}
            disabled={!priceValid}
            className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-medium py-2.5 rounded-xl bg-[#0F766E] text-white hover:bg-[#0D9488] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <UserCheck size={15} />
            {needsFinalPrice
              ? (zh ? '確認並設定價格' : 'Confirm with Price')
              : t('confirmBookingRequest')}
            <ArrowRight size={14} />
          </button>
          <button
            onClick={() => { if (confirm(t('cancelConfirm'))) void onUpdateStatus(booking.id, 'cancelled'); }}
            className="inline-flex items-center justify-center gap-1.5 text-sm font-medium py-2.5 px-4 rounded-xl border border-[#E5E7EB] bg-white text-[#6B7280] hover:border-red-300 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
          >
            <X size={15} />
            {zh ? '拒絕' : 'Decline'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ContactChip({
  href,
  icon,
  label,
  value,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <a
      href={href}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
      onClick={(e) => e.stopPropagation()}
      className="flex items-center gap-2.5 rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 hover:border-[#0F766E]/50 hover:bg-[#0F766E]/[0.02] transition-colors group min-w-0"
    >
      <span className="w-7 h-7 rounded-full bg-[#F3F4F6] group-hover:bg-[#0F766E]/10 flex items-center justify-center text-[#6B7280] group-hover:text-[#0F766E] transition-colors shrink-0">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[9px] uppercase tracking-[0.18em] text-[#9CA3AF] leading-none">{label}</p>
        <p className="text-[12px] font-medium text-[#111111] truncate group-hover:text-[#0F766E] transition-colors mt-0.5">
          {value}
        </p>
      </div>
    </a>
  );
}
