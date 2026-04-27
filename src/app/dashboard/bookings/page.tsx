'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n/context';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { formatPrice, formatTime } from '@/lib/utils';
import type { Booking } from '@/lib/types';
import {
  format, parseISO, subDays,
  startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, isSameDay, addMonths, subMonths,
} from 'date-fns';
import {
  UserCheck, AlertTriangle, X, List, CalendarDays,
  ChevronLeft, ChevronRight, SlidersHorizontal, ImageIcon,
  Search, Inbox, Phone, Mail, MessageCircle, Clock as ClockIcon,
} from 'lucide-react';

const STATUS_BADGE: Record<string, { variant: 'default' | 'success' | 'warning' | 'danger' | 'muted'; label_zh: string; label_en: string }> = {
  pending: { variant: 'warning', label_zh: '待確認', label_en: 'Pending' },
  confirmed: { variant: 'default', label_zh: '已確認', label_en: 'Confirmed' },
  completed: { variant: 'success', label_zh: '已完成', label_en: 'Completed' },
  no_show: { variant: 'danger', label_zh: '爽約', label_en: 'No-Show' },
  cancelled: { variant: 'muted', label_zh: '已取消', label_en: 'Cancelled' },
};

const STATUS_DOT: Record<string, string> = {
  pending: '#D97706',
  confirmed: '#0F766E',
  completed: '#10B981',
  no_show: '#EF4444',
  cancelled: '#9CA3AF',
};

const STATUS_FILTERS = ['all', 'pending', 'confirmed', 'completed', 'no_show', 'cancelled'] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

export default function BookingsPage() {
  const { t, locale } = useI18n();
  const zh = locale === 'zh-HK';

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [filterOpen, setFilterOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');

  const loadBookings = useCallback(async () => {
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

    let query = supabase
      .from('bookings')
      .select('*, service:services(*), booking_answers(*, question:booking_questions(*))')
      .eq('business_id', biz.id)
      .order('booking_date', { ascending: false })
      .order('start_time', { ascending: false });

    if (filterOpen) {
      query = query.gte('booking_date', dateFrom).lte('booking_date', dateTo);
    }

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data } = await query.limit(200);
    setBookings(data || []);
    setLoading(false);
  }, [filterOpen, dateFrom, dateTo, statusFilter]);

  useEffect(() => {
    const run = async () => {
      await loadBookings();
    };

    void run();
  }, [loadBookings]);

  const updateStatus = async (id: string, status: string) => {
    const supabase = createClient();
    await supabase.from('bookings').update({ status }).eq('id', id);

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

    loadBookings();
  };

  const switchToCalendar = () => {
    const today = new Date();
    setCalendarDate(today);
    setDateFrom(format(startOfMonth(today), 'yyyy-MM-dd'));
    setDateTo(format(endOfMonth(today), 'yyyy-MM-dd'));
    setView('calendar');
  };

  const switchToList = () => {
    setView('list');
  };

  const navigateCalendar = (dir: 'prev' | 'next') => {
    const newDate = dir === 'prev' ? subMonths(calendarDate, 1) : addMonths(calendarDate, 1);
    setCalendarDate(newDate);
    setDateFrom(format(startOfMonth(newDate), 'yyyy-MM-dd'));
    setDateTo(format(endOfMonth(newDate), 'yyyy-MM-dd'));
  };

  // Client-side search filter (atop the server filters).
  const visibleBookings = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return bookings;
    return bookings.filter((b) => {
      return (
        b.customer_name.toLowerCase().includes(q) ||
        (b.customer_phone || '').toLowerCase().includes(q) ||
        (b.service?.name || '').toLowerCase().includes(q) ||
        (b.service?.name_zh || '').toLowerCase().includes(q)
      );
    });
  }, [bookings, search]);

  const summary = useMemo(() => {
    const counts: Record<string, number> = { confirmed: 0, completed: 0, pending: 0, no_show: 0, cancelled: 0 };
    let revenue = 0;
    for (const b of bookings) {
      if (b.status in counts) counts[b.status] += 1;
      if (b.status === 'completed') {
        const price = b.price_hkd ?? b.service?.price_hkd ?? 0;
        revenue += price;
      }
    }
    return { counts, revenue };
  }, [bookings]);

  return (
    <div className="space-y-7">
      {/* ── HEADER ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between animate-fade-up">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#9CA3AF] mb-1">
            {zh ? '預約紀錄' : 'History'} ·{' '}
            <span className="text-[#6B7280]">
              {bookings.length} {zh ? '筆紀錄' : bookings.length === 1 ? 'record' : 'records'}
            </span>
          </p>
          <h1 className="font-display text-[28px] md:text-[34px] leading-[1.05] font-light text-[#111111]">
            {t('bookingHistory')}<span className="text-[#0F766E]">.</span>
          </h1>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-2">
          {view === 'list' && (
            <button
              onClick={() => setFilterOpen((o) => !o)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer border ${
                filterOpen
                  ? 'border-[#0F766E] text-[#0F766E] bg-[#0F766E]/5'
                  : 'border-[#E5E7EB] text-[#6B7280] hover:text-[#111111] hover:border-[#9CA3AF]'
              }`}
            >
              <SlidersHorizontal size={13} />
              {zh ? '篩選日期' : 'Filter dates'}
            </button>
          )}
          <div className="inline-flex p-0.5 bg-[#F3F4F6] rounded-lg">
            <button
              onClick={switchToList}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                view === 'list' ? 'bg-white shadow-sm text-[#0F766E]' : 'text-[#6B7280] hover:text-[#111111]'
              }`}
            >
              <List size={13} />
              {zh ? '列表' : 'List'}
            </button>
            <button
              onClick={switchToCalendar}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                view === 'calendar' ? 'bg-white shadow-sm text-[#0F766E]' : 'text-[#6B7280] hover:text-[#111111]'
              }`}
            >
              <CalendarDays size={13} />
              {zh ? '月曆' : 'Calendar'}
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI STRIP ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-up" style={{ animationDelay: '60ms' }}>
        <SummaryCard
          eyebrow={zh ? '已確認' : 'Confirmed'}
          value={summary.counts.confirmed}
          color={STATUS_DOT.confirmed}
        />
        <SummaryCard
          eyebrow={zh ? '已完成' : 'Completed'}
          value={summary.counts.completed}
          color={STATUS_DOT.completed}
        />
        <SummaryCard
          eyebrow={zh ? '收入' : 'Revenue'}
          value={summary.revenue}
          format="currency"
          color="#111111"
          hint={zh ? '已完成預約' : 'Completed bookings'}
        />
        <SummaryCard
          eyebrow={zh ? '其他' : 'Other'}
          value={summary.counts.pending + summary.counts.no_show + summary.counts.cancelled}
          color="#9CA3AF"
          hint={zh ? '待確認 / 爽約 / 取消' : 'Pending / no-show / cancelled'}
        />
      </div>

      {/* ── DATE FILTER (collapsible) ──────────────────────────── */}
      {view === 'list' && filterOpen && (
        <Card className="p-5 animate-fade-up">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[140px]">
              <Input
                id="date-from"
                label={zh ? '由' : 'From'}
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="flex-1 min-w-[140px]">
              <Input
                id="date-to"
                label={zh ? '至' : 'To'}
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <button
              onClick={() => {
                setDateFrom(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
                setDateTo(format(new Date(), 'yyyy-MM-dd'));
              }}
              className="text-xs text-[#0F766E] hover:underline self-end pb-3"
            >
              {zh ? '重設' : 'Reset'}
            </button>
          </div>
        </Card>
      )}

      {/* ── STATUS CHIP FILTERS + SEARCH (list view only) ──────── */}
      {view === 'list' && (
        <div className="flex flex-col gap-3 animate-fade-up" style={{ animationDelay: '120ms' }}>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((s) => {
              const active = statusFilter === s;
              const label = s === 'all'
                ? (zh ? '全部' : 'All')
                : zh ? STATUS_BADGE[s].label_zh : STATUS_BADGE[s].label_en;
              const count = s === 'all' ? bookings.length : (summary.counts[s] || 0);
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer border ${
                    active
                      ? 'bg-[#111111] text-white border-[#111111]'
                      : 'bg-white text-[#6B7280] border-[#E5E7EB] hover:border-[#9CA3AF] hover:text-[#111111]'
                  }`}
                >
                  {s !== 'all' && (
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: active ? '#FFFFFF' : STATUS_DOT[s] }}
                    />
                  )}
                  {label}
                  <span className={`tabular-nums text-[10px] ${active ? 'opacity-70' : 'opacity-60'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative">
            <Search
              size={14}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={zh ? '搜尋客人姓名、電話、服務…' : 'Search name, phone, service…'}
              className="w-full h-10 pl-9 pr-9 rounded-xl border border-[#E5E7EB] bg-white text-sm text-[#111111] placeholder:text-[#9CA3AF] transition-colors focus:outline-none focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/15"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#111111] transition-colors cursor-pointer"
                aria-label="clear"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── CALENDAR ──────────────────────────────────────────── */}
      {view === 'calendar' && (
        <div className="animate-fade-up" style={{ animationDelay: '120ms' }}>
          <CalendarView
            bookings={visibleBookings}
            calendarDate={calendarDate}
            loading={loading}
            onPrev={() => navigateCalendar('prev')}
            onNext={() => navigateCalendar('next')}
            onToday={() => {
              const today = new Date();
              setCalendarDate(today);
              setDateFrom(format(startOfMonth(today), 'yyyy-MM-dd'));
              setDateTo(format(endOfMonth(today), 'yyyy-MM-dd'));
            }}
            onSelectBooking={setSelectedBooking}
            zh={zh}
          />
        </div>
      )}

      {/* ── LIST ──────────────────────────────────────────────── */}
      {view === 'list' && (
        <div className="animate-fade-up" style={{ animationDelay: '180ms' }}>
          {loading ? (
            <Card className="p-12">
              <div className="text-center text-[#9CA3AF] text-sm">{t('loading')}</div>
            </Card>
          ) : visibleBookings.length === 0 ? (
            <EmptyState zh={zh} hint={search ? (zh ? '沒有符合搜尋的紀錄' : 'No matches for this search') : undefined} />
          ) : (
            <BookingsList
              bookings={visibleBookings}
              zh={zh}
              onSelect={setSelectedBooking}
            />
          )}
        </div>
      )}

      {selectedBooking && (
        <BookingDetailModal
          booking={selectedBooking}
          zh={zh}
          onClose={() => setSelectedBooking(null)}
          onUpdateStatus={(id, status) => { updateStatus(id, status); setSelectedBooking(null); }}
          t={t}
        />
      )}
    </div>
  );
}

// ── SUMMARY CARD ─────────────────────────────────────────────────────────────

function SummaryCard({
  eyebrow,
  value,
  color,
  hint,
  format: fmt,
}: {
  eyebrow: string;
  value: number;
  color: string;
  hint?: string;
  format?: 'currency';
}) {
  const display = fmt === 'currency' ? formatCurrencyShort(value) : value.toString();
  const dim = value === 0;
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF] font-medium">{eyebrow}</p>
        <span className="w-1.5 h-1.5 rounded-full mt-1.5" style={{ background: dim ? '#E5E7EB' : color }} />
      </div>
      <div className="font-display text-[36px] leading-none font-light tabular-nums mt-2" style={{ color: dim ? '#D1D5DB' : '#111111' }}>
        {display}
      </div>
      {hint && <p className="text-[11px] text-[#9CA3AF] mt-2 tracking-wide">{hint}</p>}
    </Card>
  );
}

function formatCurrencyShort(n: number) {
  if (n === 0) return 'HK$0';
  if (n >= 1_000_000) return `HK$${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 10_000) return `HK$${(n / 1000).toFixed(0)}k`;
  if (n >= 1000) return `HK$${(n / 1000).toFixed(1)}k`;
  return `HK$${n}`;
}

// ── BOOKINGS LIST (grouped by date) ──────────────────────────────────────────

function BookingsList({
  bookings,
  zh,
  onSelect,
}: {
  bookings: Booking[];
  zh: boolean;
  onSelect: (b: Booking) => void;
}) {
  // group consecutively-sorted bookings by date.
  const groups = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of bookings) {
      if (!map.has(b.booking_date)) map.set(b.booking_date, []);
      map.get(b.booking_date)!.push(b);
    }
    return Array.from(map.entries());
  }, [bookings]);

  return (
    <div className="space-y-6">
      {groups.map(([date, group]) => (
        <section key={date}>
          <div className="flex items-baseline gap-3 mb-3">
            <span className="font-display text-[18px] font-light text-[#111111] tabular-nums">
              {format(parseISO(date), zh ? 'M月d日' : 'MMM d')}
            </span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-[#9CA3AF]">
              {format(parseISO(date), zh ? 'EEEE' : 'EEEE')}
            </span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-[#9CA3AF] tabular-nums">
              · {group.length}
            </span>
            <span className="flex-1 h-px bg-[#E5E7EB]" />
          </div>
          <div className="space-y-2">
            {group.map((b) => (
              <BookingRow key={b.id} booking={b} zh={zh} onSelect={onSelect} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function BookingRow({
  booking,
  zh,
  onSelect,
}: {
  booking: Booking;
  zh: boolean;
  onSelect: (b: Booking) => void;
}) {
  const badge = STATUS_BADGE[booking.status];
  const svcName = booking.service ? (zh && booking.service.name_zh ? booking.service.name_zh : booking.service.name) : null;
  const accent = STATUS_DOT[booking.status];
  const displayPrice = booking.price_hkd ?? booking.service?.price_hkd ?? null;
  const dim = booking.status === 'cancelled' || booking.status === 'no_show';

  return (
    <button
      onClick={() => onSelect(booking)}
      className={`relative w-full text-left bg-white rounded-xl border border-[#E5E7EB] hover:border-[#0F766E]/40 hover:shadow-sm transition-all overflow-hidden cursor-pointer ${
        dim ? 'opacity-70' : ''
      }`}
    >
      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: accent }} />
      <div className="pl-5 pr-4 py-3 flex items-center gap-4">
        {/* time */}
        <div className="w-[64px] shrink-0">
          <div className="text-sm font-semibold text-[#111111] tabular-nums leading-none">
            {formatTime(booking.start_time)}
          </div>
          <div className="text-[11px] text-[#9CA3AF] tabular-nums leading-none mt-1">
            {formatTime(booking.end_time)}
          </div>
        </div>

        <div className="h-9 w-px bg-[#F3F4F6]" />

        {/* content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-sm font-semibold text-[#111111] truncate">
              {booking.customer_name}
            </span>
            {booking.is_manual && (
              <span className="text-[10px] uppercase tracking-wider text-[#9CA3AF]">M</span>
            )}
            {booking.customer_image_url && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-[#7C3AED] bg-[#F5F3FF] border border-[#DDD6FE] px-1.5 py-0.5 rounded-full">
                <ImageIcon size={9} />
                {zh ? '附圖' : 'Photo'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[12px] text-[#6B7280] flex-wrap">
            {svcName && <span className="truncate">{svcName}</span>}
            {displayPrice !== null && (
              <span className="text-[#0F766E] font-medium">{formatPrice(displayPrice)}</span>
            )}
            {booking.customer_phone && (
              <span className="hidden sm:inline">· {booking.customer_phone}</span>
            )}
          </div>
        </div>

        <Badge variant={badge.variant} className="shrink-0">
          {zh ? badge.label_zh : badge.label_en}
        </Badge>
        <ChevronRight size={15} className="text-[#9CA3AF] shrink-0 hidden sm:block" />
      </div>
    </button>
  );
}

// ── EMPTY STATE ──────────────────────────────────────────────────────────────

function EmptyState({ zh, hint }: { zh: boolean; hint?: string }) {
  return (
    <Card className="relative overflow-hidden p-12">
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
      <div className="relative text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#0F766E]/10 mb-4">
          <Inbox size={26} className="text-[#0F766E]" />
        </div>
        <p className="font-display text-2xl font-light text-[#111111]">
          {zh ? '暫無紀錄' : 'No records yet.'}
        </p>
        <p className="text-sm text-[#6B7280] mt-1.5">
          {hint || (zh ? '所有預約都會自動歸檔到這裡。' : 'Every booking ends up here.')}
        </p>
      </div>
    </Card>
  );
}

// ── CALENDAR ─────────────────────────────────────────────────────────────────

function CalendarView({
  bookings,
  calendarDate,
  loading,
  onPrev,
  onNext,
  onToday,
  onSelectBooking,
  zh,
}: {
  bookings: Booking[];
  calendarDate: Date;
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onSelectBooking: (b: Booking) => void;
  zh: boolean;
}) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const firstDay = startOfMonth(calendarDate);
  const days = eachDayOfInterval({ start: firstDay, end: endOfMonth(calendarDate) });
  const startOffset = getDay(firstDay);
  const cells: (Date | null)[] = [...Array(startOffset).fill(null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);

  const dayHeaders = zh
    ? ['日', '一', '二', '三', '四', '五', '六']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const today = new Date();
  const selectedDayBookings = selectedDay
    ? bookings.filter((b) => b.booking_date === selectedDay)
    : [];

  return (
    <div className="space-y-4">
      <Card className="p-5 sm:p-6">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={onPrev}
            className="w-9 h-9 rounded-lg border border-[#E5E7EB] hover:border-[#9CA3AF] flex items-center justify-center text-[#6B7280] hover:text-[#111111] transition-colors cursor-pointer"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="flex items-baseline gap-3">
            <h2 className="font-display text-xl sm:text-2xl font-light text-[#111111] tabular-nums">
              {format(calendarDate, zh ? 'M月' : 'MMMM')}
            </h2>
            <span className="text-[#9CA3AF] tabular-nums text-sm">
              {format(calendarDate, 'yyyy')}
            </span>
            <button
              onClick={onToday}
              className="text-[10px] uppercase tracking-[0.18em] text-[#0F766E] hover:underline cursor-pointer"
            >
              {zh ? '今天' : 'Today'}
            </button>
          </div>
          <button
            onClick={onNext}
            className="w-9 h-9 rounded-lg border border-[#E5E7EB] hover:border-[#9CA3AF] flex items-center justify-center text-[#6B7280] hover:text-[#111111] transition-colors cursor-pointer"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-2">
          {dayHeaders.map((d) => (
            <div
              key={d}
              className="text-center text-[10px] uppercase tracking-[0.18em] text-[#9CA3AF] font-medium py-1"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="text-center py-12 text-[#9CA3AF] text-sm">{zh ? '載入中…' : 'Loading…'}</div>
        ) : (
          <div className="grid grid-cols-7 gap-1.5">
            {cells.map((day, i) => {
              if (!day) {
                return <div key={i} className="min-h-[68px] sm:min-h-[88px]" />;
              }
              const dateStr = format(day, 'yyyy-MM-dd');
              const dayBookings = bookings.filter((b) => b.booking_date === dateStr);
              const isToday = isSameDay(day, today);
              const isSelected = selectedDay === dateStr;
              const isWeekend = getDay(day) === 0 || getDay(day) === 6;

              const counts = dayBookings.reduce<Record<string, number>>((acc, b) => {
                acc[b.status] = (acc[b.status] || 0) + 1;
                return acc;
              }, {});

              return (
                <button
                  key={i}
                  onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                  className={`relative min-h-[68px] sm:min-h-[88px] p-2 rounded-lg flex flex-col items-start text-left transition-all cursor-pointer border ${
                    isSelected
                      ? 'border-[#0F766E] bg-[#0F766E]/[0.04]'
                      : dayBookings.length > 0
                        ? 'border-[#E5E7EB] hover:border-[#0F766E]/40 hover:bg-[#FAFAF8]'
                        : isWeekend
                          ? 'border-transparent bg-[#FAFAF8]/60'
                          : 'border-transparent hover:bg-[#FAFAF8]'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span
                      className={`text-[13px] tabular-nums font-medium ${
                        isToday
                          ? 'text-white bg-[#0F766E] rounded-full w-6 h-6 flex items-center justify-center'
                          : isWeekend
                            ? 'text-[#9CA3AF]'
                            : 'text-[#111111]'
                      }`}
                    >
                      {format(day, 'd')}
                    </span>
                    {dayBookings.length > 0 && (
                      <span className="text-[10px] text-[#9CA3AF] tabular-nums">
                        {dayBookings.length}
                      </span>
                    )}
                  </div>

                  {/* status segment bar */}
                  {dayBookings.length > 0 && (
                    <div className="mt-auto w-full">
                      <div className="flex h-1 rounded-full overflow-hidden bg-[#F3F4F6]">
                        {(['confirmed', 'completed', 'pending', 'no_show', 'cancelled'] as const).map((s) =>
                          counts[s] > 0 ? (
                            <div
                              key={s}
                              className="h-full"
                              style={{
                                width: `${(counts[s] / dayBookings.length) * 100}%`,
                                background: STATUS_DOT[s],
                              }}
                            />
                          ) : null
                        )}
                      </div>
                      <div className="hidden sm:flex gap-0.5 mt-1.5 flex-wrap">
                        {dayBookings.slice(0, 3).map((b) => (
                          <span
                            key={b.id}
                            className="text-[10px] tabular-nums text-[#6B7280] truncate max-w-full"
                            style={{ borderLeft: `2px solid ${STATUS_DOT[b.status]}`, paddingLeft: 4 }}
                          >
                            {formatTime(b.start_time).replace(' ', '')}
                          </span>
                        ))}
                        {dayBookings.length > 3 && (
                          <span className="text-[9px] text-[#9CA3AF]">+{dayBookings.length - 3}</span>
                        )}
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-3 mt-5 pt-4 border-t border-dashed border-[#E5E7EB] text-[10px] uppercase tracking-[0.15em] text-[#9CA3AF] flex-wrap">
          {(['confirmed', 'completed', 'pending', 'no_show', 'cancelled'] as const).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_DOT[s] }} />
              {zh ? STATUS_BADGE[s].label_zh : STATUS_BADGE[s].label_en}
            </span>
          ))}
        </div>
      </Card>

      {/* Day detail panel */}
      {selectedDay && (
        <Card className="p-5 sm:p-6 animate-fade-up">
          <div className="flex items-baseline justify-between gap-3 mb-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF] mb-1">
                {zh ? '當日預約' : 'On this day'}
              </p>
              <h3 className="font-display text-xl font-light text-[#111111]">
                {format(parseISO(selectedDay), zh ? 'M月d日 EEEE' : 'EEEE, MMMM d')}
              </h3>
            </div>
            <button
              onClick={() => setSelectedDay(null)}
              className="text-[#9CA3AF] hover:text-[#111111] cursor-pointer transition-colors"
            >
              <X size={18} />
            </button>
          </div>
          {selectedDayBookings.length === 0 ? (
            <p className="text-sm text-[#9CA3AF] italic text-center py-6">
              {zh ? '當日暫無預約' : 'A clear day. Take a breath.'}
            </p>
          ) : (
            <div className="space-y-2">
              {[...selectedDayBookings]
                .sort((a, b) => a.start_time.localeCompare(b.start_time))
                .map((b) => (
                  <BookingRow
                    key={b.id}
                    booking={b}
                    zh={zh}
                    onSelect={(x) => { onSelectBooking(x); setSelectedDay(null); }}
                  />
                ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ── DETAIL MODAL ─────────────────────────────────────────────────────────────

function BookingDetailModal({
  booking,
  zh,
  onClose,
  onUpdateStatus,
  t,
}: {
  booking: Booking;
  zh: boolean;
  onClose: () => void;
  onUpdateStatus: (id: string, status: string) => void;
  t: ReturnType<typeof useI18n>['t'];
}) {
  const badge = STATUS_BADGE[booking.status];
  const accent = STATUS_DOT[booking.status];
  const serviceName = booking.service
    ? zh && booking.service.name_zh
      ? booking.service.name_zh
      : booking.service.name
    : null;
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

  const isTbc = booking.service?.pricing_type === 'tbc';
  const priceLabel = booking.price_hkd != null
    ? formatPrice(booking.price_hkd)
    : isTbc
      ? (zh ? '待定' : 'TBC')
      : null;
  const date = parseISO(booking.booking_date);
  const duration = booking.service?.duration_minutes;

  return (
    <div className="fixed inset-0 bg-black/55 backdrop-blur-[2px] flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* status edge */}
        <div className="h-1 w-full shrink-0" style={{ background: accent }} />

        {/* HERO */}
        <div className="relative px-6 pt-6 pb-5 shrink-0">
          <DotPatternModal />
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full text-[#9CA3AF] hover:text-[#111111] hover:bg-[#F3F4F6] transition-colors cursor-pointer flex items-center justify-center z-10"
          >
            <X size={16} />
          </button>

          <div className="relative">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#9CA3AF] font-medium mb-3">
              {zh ? '預約詳情' : 'Booking · Detail'}
            </p>
            <div className="flex items-end gap-5">
              <div className="text-center shrink-0">
                <div className="font-display text-[56px] leading-[0.9] font-light text-[#111111] tabular-nums">
                  {format(date, 'd')}
                </div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#9CA3AF] mt-1">
                  {format(date, zh ? 'M月' : 'MMM')}
                </div>
              </div>
              <div className="h-14 w-px bg-[#E5E7EB]" />
              <div className="min-w-0 pb-1">
                <p className="text-[10px] uppercase tracking-[0.18em] text-[#9CA3AF] mb-1">
                  {format(date, zh ? 'EEEE' : 'EEEE')}
                </p>
                <div className="font-display text-xl font-light text-[#111111] leading-tight tabular-nums">
                  {formatTime(booking.start_time)} <span className="text-[#9CA3AF]">→</span> {formatTime(booking.end_time)}
                </div>
                {duration && (
                  <p className="text-[11px] text-[#9CA3AF] mt-1 inline-flex items-center gap-1">
                    <ClockIcon size={11} /> {duration} {zh ? '分鐘' : 'min'}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-dashed border-[#E5E7EB] flex items-baseline gap-2 flex-wrap">
              <h3 className="font-display text-2xl font-light text-[#111111]">
                {booking.customer_name}
              </h3>
              {booking.is_manual && (
                <span className="text-[9px] uppercase tracking-[0.2em] text-[#9CA3AF] border border-[#E5E7EB] px-1.5 py-0.5 rounded">
                  {zh ? '手動' : 'Manual'}
                </span>
              )}
              <Badge variant={badge.variant}>
                {zh ? badge.label_zh : badge.label_en}
              </Badge>
            </div>
          </div>
        </div>

        {/* BODY */}
        <div className="px-6 pb-5 space-y-4 overflow-y-auto flex-1">
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

          {/* CUSTOMER NOTES — pull-quote style */}
          {customerNotesSection.length > 0 && (
            <div className="relative rounded-xl bg-[#FAFAF8] border border-[#E5E7EB] p-4 pl-5">
              <span
                aria-hidden
                className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl"
                style={{ background: '#0F766E' }}
              />
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
        </div>

        {/* FOOTER ACTIONS */}
        {booking.status === 'pending' && (
          <div className="flex gap-2 px-6 py-4 border-t border-[#E5E7EB] bg-[#FAFAF8] shrink-0">
            <button
              onClick={() => onUpdateStatus(booking.id, 'confirmed')}
              className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-medium py-2.5 rounded-xl bg-[#0F766E] text-white hover:bg-[#0D9488] transition-colors cursor-pointer"
            >
              <UserCheck size={15} />
              {t('confirmBookingRequest')}
            </button>
            <button
              onClick={() => { if (confirm(t('cancelConfirm'))) onUpdateStatus(booking.id, 'cancelled'); }}
              className="inline-flex items-center justify-center gap-1.5 text-sm font-medium py-2.5 px-4 rounded-xl border border-[#E5E7EB] bg-white text-[#6B7280] hover:border-red-300 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
            >
              <X size={15} />
              {zh ? '拒絕' : 'Decline'}
            </button>
          </div>
        )}

        {booking.status === 'confirmed' && (
          <div className="flex gap-2 px-6 py-4 border-t border-[#E5E7EB] bg-[#FAFAF8] shrink-0">
            <button
              onClick={() => onUpdateStatus(booking.id, 'completed')}
              className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-medium py-2.5 rounded-xl border border-[#E5E7EB] bg-white text-[#111111] hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 transition-colors cursor-pointer"
            >
              <UserCheck size={15} className="text-emerald-600" />
              {zh ? '完成' : 'Done'}
            </button>
            <button
              onClick={() => onUpdateStatus(booking.id, 'no_show')}
              className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-medium py-2.5 rounded-xl border border-[#E5E7EB] bg-white text-[#111111] hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700 transition-colors cursor-pointer"
            >
              <AlertTriangle size={15} className="text-amber-500" />
              {zh ? '爽約' : 'No-Show'}
            </button>
            <button
              onClick={() => { if (confirm(t('cancelConfirm'))) onUpdateStatus(booking.id, 'cancelled'); }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-medium py-2.5 rounded-xl border border-[#E5E7EB] bg-white text-[#111111] hover:border-red-300 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
            >
              <X size={15} className="text-red-500" />
              {zh ? '取消' : 'Cancel'}
            </button>
          </div>
        )}
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

function DotPatternModal() {
  return (
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
  );
}
