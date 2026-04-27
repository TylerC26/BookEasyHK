'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n/context';
import type { TranslationKey } from '@/lib/i18n/translations';
import { Card, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { formatPrice, formatTime, addMinutesToTime, timeToMinutes } from '@/lib/utils';
import type { Booking, Business, Service } from '@/lib/types';
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  subDays,
  differenceInCalendarDays,
  startOfDay,
  getDay,
} from 'date-fns';
import {
  CalendarCheck,
  Clock,
  AlertTriangle,
  ChevronRight,
  Plus,
  X,
  UserCheck,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Phone,
  Mail,
  MessageCircle,
  PencilLine,
} from 'lucide-react';

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

const STATUS_FILL: Record<string, string> = {
  confirmed: '#0F766E',
  completed: '#10B981',
  pending: '#D97706',
  no_show: '#EF4444',
  cancelled: '#9CA3AF',
};

const HOUR_START = 8;
const HOUR_END = 21;

export default function DashboardPage() {
  const { t, locale } = useI18n();
  const zh = locale === 'zh-HK';

  const [business, setBusiness] = useState<Business | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [todayBookings, setTodayBookings] = useState<Booking[]>([]);
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [monthBookings, setMonthBookings] = useState<Booking[]>([]);
  const [pendingBookings, setPendingBookings] = useState<Booking[]>([]);
  const [last60, setLast60] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [showManual, setShowManual] = useState(false);
  const [showBlock, setShowBlock] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [now, setNow] = useState(() => new Date());

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

    const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');

    const { data: monthData } = await supabase
      .from('bookings')
      .select('*, service:services(*)')
      .eq('business_id', biz.id)
      .gte('booking_date', monthStart)
      .lte('booking_date', monthEnd)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false });

    setMonthBookings(monthData || []);

    const { data: pendingData } = await supabase
      .from('bookings')
      .select('*, service:services(*), booking_answers(*, question:booking_questions(*))')
      .eq('business_id', biz.id)
      .eq('status', 'pending')
      .order('booking_date')
      .order('start_time')
      .limit(10);

    setPendingBookings(pendingData || []);

    // 60-day window for trend chart, top services, peak hours heatmap.
    const sixtyAgo = format(subDays(new Date(), 59), 'yyyy-MM-dd');
    const { data: trendData } = await supabase
      .from('bookings')
      .select('id, business_id, booking_date, start_time, end_time, status, price_hkd, service_id, service:services(id, name, name_zh, price_hkd)')
      .eq('business_id', biz.id)
      .gte('booking_date', sixtyAgo)
      .neq('status', 'cancelled');

    setLast60((trendData as unknown as Booking[]) || []);

    setLoading(false);
  }, []);

  useEffect(() => {
    const run = async () => {
      await loadData();
    };
    void run();
  }, [loadData]);

  // Tick the "now" indicator every minute.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const updateBookingStatus = async (bookingId: string, status: string) => {
    const supabase = createClient();
    await supabase.from('bookings').update({ status }).eq('id', bookingId);

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

  // ── DERIVED ────────────────────────────────────────────────────────────────

  const revenueMonth = useMemo(() => monthBookings.reduce((sum, b) => {
    if (b.status !== 'completed') return sum;
    const price = b.price_hkd ?? (b.service as Service | null)?.price_hkd ?? 0;
    return sum + price;
  }, 0), [monthBookings]);

  // 30-day daily series for revenue + bookings; week-over-week delta for revenue.
  const trend = useMemo(() => buildDailySeries(last60, 30, now), [last60, now]);

  const wowRevenue = useMemo(() => {
    const last7 = trend.slice(-7).reduce((s, d) => s + d.revenue, 0);
    const prev7 = trend.slice(-14, -7).reduce((s, d) => s + d.revenue, 0);
    if (prev7 === 0) return last7 > 0 ? 100 : 0;
    return Math.round(((last7 - prev7) / prev7) * 100);
  }, [trend]);

  const wowBookings = useMemo(() => {
    const last7 = trend.slice(-7).reduce((s, d) => s + d.count, 0);
    const prev7 = trend.slice(-14, -7).reduce((s, d) => s + d.count, 0);
    if (prev7 === 0) return last7 > 0 ? 100 : 0;
    return Math.round(((last7 - prev7) / prev7) * 100);
  }, [trend]);

  // Status mix for the current month.
  const statusMix = useMemo(() => {
    const counts: Record<string, number> = { confirmed: 0, completed: 0, pending: 0, no_show: 0 };
    for (const b of monthBookings) {
      if (b.status in counts) counts[b.status] += 1;
    }
    for (const p of pendingBookings) {
      // pending isn't in monthBookings (which excludes cancelled but includes pending only if within month);
      // ensure pending count reflects all open requests.
      if (p.booking_date >= format(startOfMonth(new Date()), 'yyyy-MM-dd')) {
        // already counted
      }
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    return { counts, total };
  }, [monthBookings, pendingBookings]);

  // Top services in the last 60 days, by booking count.
  const topServices = useMemo(() => {
    const map = new Map<string, { name: string; count: number; revenue: number }>();
    for (const b of last60) {
      if (!b.service_id) continue;
      const svc = b.service as Service | undefined;
      const key = b.service_id;
      const name = svc ? (zh && svc.name_zh ? svc.name_zh : svc.name) : (zh ? '其他' : 'Other');
      const price = b.price_hkd ?? svc?.price_hkd ?? 0;
      const cur = map.get(key) ?? { name, count: 0, revenue: 0 };
      cur.count += 1;
      cur.revenue += b.status === 'completed' ? price : 0;
      map.set(key, cur);
    }
    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [last60, zh]);

  // Peak hours: 7 days × (HOUR_END - HOUR_START) hours intensity grid.
  const heatmap = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () =>
      Array.from({ length: HOUR_END - HOUR_START }, () => 0)
    );
    for (const b of last60) {
      const dow = getDay(parseISO(b.booking_date)); // 0 = Sunday
      const hr = parseInt(b.start_time.split(':')[0], 10);
      if (hr < HOUR_START || hr >= HOUR_END) continue;
      grid[dow][hr - HOUR_START] += 1;
    }
    let max = 1;
    for (const row of grid) for (const v of row) if (v > max) max = v;
    return { grid, max };
  }, [last60]);

  // Next-up appointment today.
  const nextUp = useMemo(() => {
    const minsNow = now.getHours() * 60 + now.getMinutes();
    return todayBookings
      .filter((b) => b.status === 'confirmed' && timeToMinutes(b.start_time) >= minsNow)
      .sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time))[0] || null;
  }, [todayBookings, now]);

  const todayCompleted = todayBookings.filter((b) => b.status === 'completed').length;
  const todayConfirmed = todayBookings.filter((b) => b.status === 'confirmed').length;

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted">{t('loading')}</div>;
  }

  const greeting = greetingFor(now, zh);
  const todayLabel = format(now, zh ? 'yyyy年M月d日 EEEE' : 'EEEE, MMMM d, yyyy');

  return (
    <div className="space-y-7">
      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between animate-fade-up">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#9CA3AF] mb-1">
            {greeting} ·  <span className="text-[#6B7280]">{todayLabel}</span>
          </p>
          <h1 className="font-display text-[28px] md:text-[34px] leading-[1.05] font-light text-[#111111]">
            {business?.name || t('dashboard')}
            <span className="text-[#0F766E]">.</span>
          </h1>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" className="whitespace-nowrap" onClick={() => setShowBlock(true)}>
            {t('blockTime')}
          </Button>
          <Button size="sm" className="whitespace-nowrap" onClick={() => setShowManual(true)}>
            <Plus size={16} /> {t('manualBooking')}
          </Button>
        </div>
      </div>

      {/* ── HERO STRIP ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-fade-up" style={{ animationDelay: '60ms' }}>
        {/* TODAY */}
        <Card className="relative overflow-hidden p-6">
          <DotPattern />
          <div className="relative">
            <Eyebrow>{zh ? '今日' : 'Today'}</Eyebrow>
            <div className="flex items-baseline gap-3 mt-1">
              <span className="font-display text-[64px] leading-none font-light text-[#111111] tabular-nums">
                {todayBookings.length}
              </span>
              <span className="text-xs text-[#6B7280]">{zh ? '個預約' : 'bookings'}</span>
            </div>
            <div className="flex items-center gap-3 mt-4 text-xs">
              <Pill color="#0F766E">{todayConfirmed} {zh ? '已確認' : 'confirmed'}</Pill>
              <Pill color="#10B981">{todayCompleted} {zh ? '已完成' : 'completed'}</Pill>
            </div>
            <div className="mt-5 pt-4 border-t border-dashed border-[#E5E7EB]">
              {nextUp ? (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[#9CA3AF] mb-1">{zh ? '下一位客人' : 'Next up'}</p>
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-lg text-[#111111]">{formatTime(nextUp.start_time)}</span>
                    <span className="text-sm text-[#3D3D3D] truncate">· {nextUp.customer_name}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[#9CA3AF] italic">
                  {todayBookings.length === 0
                    ? (zh ? '今天日程清空' : 'A clear day ahead.')
                    : (zh ? '今日預約已完成' : 'All of today is wrapped.')}
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* EARNINGS */}
        <Card className="relative overflow-hidden p-6">
          <div className="flex items-start justify-between">
            <div>
              <Eyebrow>{zh ? '本月收入' : 'Earnings · Month'}</Eyebrow>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="font-display text-[40px] leading-none font-light text-[#111111] tabular-nums">
                  {formatCurrencyShort(revenueMonth)}
                </span>
                <DeltaTag value={wowRevenue} label={zh ? '對上週' : 'wow'} />
              </div>
              <p className="text-[11px] text-[#9CA3AF] mt-2 tracking-wide">
                {zh ? '已完成預約收入' : 'Completed bookings only'}
              </p>
            </div>
          </div>
          <div className="mt-3 -mx-1">
            <AreaSpark data={trend.map((d) => d.revenue)} />
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-[#9CA3AF] tracking-wider px-1">
            <span>{format(subDays(now, 29), zh ? 'M月d日' : 'MMM d')}</span>
            <span>{zh ? '今天' : 'Today'}</span>
          </div>
        </Card>

        {/* STATUS MIX */}
        <Card className="p-6">
          <Eyebrow>{zh ? '本月組合' : 'Status · Month'}</Eyebrow>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-display text-[40px] leading-none font-light text-[#111111] tabular-nums">
              {monthBookings.length}
            </span>
            <span className="text-xs text-[#6B7280]">{zh ? '預約' : 'bookings'}</span>
            <DeltaTag value={wowBookings} label={zh ? '對上週' : 'wow'} />
          </div>
          <div className="mt-5">
            <SegmentedBar
              segments={[
                { value: statusMix.counts.completed, color: STATUS_FILL.completed },
                { value: statusMix.counts.confirmed, color: STATUS_FILL.confirmed },
                { value: statusMix.counts.pending, color: STATUS_FILL.pending },
                { value: statusMix.counts.no_show, color: STATUS_FILL.no_show },
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-4 text-[11px]">
            <LegendDot color={STATUS_FILL.completed} label={zh ? '已完成' : 'Completed'} value={statusMix.counts.completed} total={statusMix.total} />
            <LegendDot color={STATUS_FILL.confirmed} label={zh ? '已確認' : 'Confirmed'} value={statusMix.counts.confirmed} total={statusMix.total} />
            <LegendDot color={STATUS_FILL.pending} label={zh ? '待確認' : 'Pending'} value={statusMix.counts.pending} total={statusMix.total} />
            <LegendDot color={STATUS_FILL.no_show} label={zh ? '爽約' : 'No-show'} value={statusMix.counts.no_show} total={statusMix.total} />
          </div>
        </Card>
      </div>

      {/* ── TODAY TIMELINE ─────────────────────────────────────────── */}
      <Card className="p-6 animate-fade-up" style={{ animationDelay: '120ms' }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <Eyebrow>{zh ? '今日時間軸' : "Today's Timeline"}</Eyebrow>
            <CardTitle className="mt-0.5">{format(now, zh ? 'M月d日 EEEE' : 'EEEE, MMM d')}</CardTitle>
          </div>
          <div className="hidden sm:flex items-center gap-3 text-[10px] text-[#9CA3AF] tracking-wider">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: STATUS_FILL.confirmed }} />{zh ? '已確認' : 'Confirmed'}</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: STATUS_FILL.completed }} />{zh ? '已完成' : 'Completed'}</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: STATUS_FILL.no_show }} />{zh ? '爽約' : 'No-show'}</span>
          </div>
        </div>
        <Timeline bookings={todayBookings} now={now} onSelect={setSelectedBooking} />
      </Card>

      {/* ── TREND + TOP SERVICES ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 animate-fade-up" style={{ animationDelay: '180ms' }}>
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-1">
            <Eyebrow>{zh ? '30 天走勢' : '30-Day Trend'}</Eyebrow>
            <span className="text-[10px] text-[#9CA3AF] tracking-wider">{zh ? '預約數量' : 'Bookings per day'}</span>
          </div>
          <div className="flex items-baseline gap-3 mb-4">
            <span className="font-display text-3xl font-light text-[#111111] tabular-nums">
              {trend.reduce((s, d) => s + d.count, 0)}
            </span>
            <span className="text-xs text-[#6B7280]">{zh ? '本月預約總數' : 'bookings · last 30 days'}</span>
          </div>
          <TrendChart data={trend} zh={zh} />
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <Eyebrow>{zh ? '熱門服務' : 'Top Services'}</Eyebrow>
            <span className="text-[10px] text-[#9CA3AF] tracking-wider">{zh ? '60 天' : '60d'}</span>
          </div>
          {topServices.length === 0 ? (
            <EmptyHint icon={<Sparkles size={26} />}>
              {zh ? '暫未有資料' : 'Not enough data yet'}
            </EmptyHint>
          ) : (
            <div className="space-y-3.5">
              {topServices.map((s, i) => {
                const pct = (s.count / topServices[0].count) * 100;
                return (
                  <div key={s.name + i}>
                    <div className="flex items-baseline justify-between text-xs mb-1.5">
                      <span className="text-[#111111] truncate">{s.name}</span>
                      <span className="tabular-nums text-[#6B7280] shrink-0 ml-2">{s.count}</span>
                    </div>
                    <div className="h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          background: i === 0 ? '#0F766E' : i === 1 ? '#14B8A6' : '#5EEAD4',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* ── PENDING + HEATMAP ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 animate-fade-up" style={{ animationDelay: '240ms' }}>
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <Eyebrow>{zh ? '待你確認' : 'Awaiting You'}</Eyebrow>
              <CardTitle className="mt-0.5">{zh ? '待確認預約' : 'Pending confirmation'}</CardTitle>
            </div>
            <Link
              href="/dashboard/requests"
              className="text-xs text-[#0F766E] hover:underline inline-flex items-center gap-0.5"
            >
              {zh ? '查看全部' : 'View all'}
              <ChevronRight size={12} />
            </Link>
          </div>
          {pendingBookings.length === 0 ? (
            <EmptyHint icon={<UserCheck size={28} />}>
              {zh ? '沒有待確認預約' : 'Inbox zero — nothing pending.'}
            </EmptyHint>
          ) : (
            <div className="space-y-3">
              {pendingBookings.slice(0, 4).map((booking) => (
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

        <Card className="p-6">
          <div className="flex items-center justify-between mb-1">
            <Eyebrow>{zh ? '高峰時段' : 'Peak Hours'}</Eyebrow>
            <span className="text-[10px] text-[#9CA3AF] tracking-wider">{zh ? '60 天 · 星期 × 時段' : '60d · day × hour'}</span>
          </div>
          <CardTitle className="mt-0.5 mb-4">{zh ? '客人最常預約' : 'When customers book'}</CardTitle>
          <Heatmap grid={heatmap.grid} max={heatmap.max} zh={zh} />
        </Card>
      </div>

      {/* ── UPCOMING ──────────────────────────────────────────────── */}
      <Card className="p-6 animate-fade-up" style={{ animationDelay: '300ms' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <Eyebrow>{zh ? '日程展望' : 'Looking Ahead'}</Eyebrow>
            <CardTitle className="mt-0.5">{t('upcoming')}</CardTitle>
          </div>
          <Link
            href="/dashboard/bookings"
            className="text-xs text-[#0F766E] hover:underline inline-flex items-center gap-0.5"
          >
            {zh ? '查看全部' : 'View all'}
            <ChevronRight size={12} />
          </Link>
        </div>
        {upcomingBookings.length === 0 ? (
          <EmptyHint icon={<Clock size={28} />}>
            {zh ? '暫無即將到來的預約' : 'Nothing on the horizon yet.'}
          </EmptyHint>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {upcomingBookings.slice(0, 6).map((booking) => (
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

      {/* ── MODALS ────────────────────────────────────────────────── */}
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

      {showManual && (
        <Modal onClose={() => setShowManual(false)} title={t('manualBooking')}>
          <div className="space-y-4">
            <Input id="manual-name" label={t('customerName')} value={manualName} onChange={(e) => setManualName(e.target.value)} required />
            <Input id="manual-phone" label={t('phoneNumber')} type="tel" value={manualPhone} onChange={(e) => setManualPhone(e.target.value)} />
            <Select
              id="manual-service"
              label={t('service')}
              value={manualService}
              onChange={(e) => setManualService(e.target.value)}
              options={[
                { value: '', label: zh ? '選擇服務' : 'Select service' },
                ...services.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
            <Input id="manual-date" label={t('date')} type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} />
            <Input id="manual-time" label={t('time')} type="time" value={manualTime} onChange={(e) => setManualTime(e.target.value)} />
            <Button className="w-full" onClick={handleManualBooking} loading={manualSubmitting} disabled={!manualName}>
              {t('confirm')}
            </Button>
          </div>
        </Modal>
      )}

      {showBlock && (
        <Modal onClose={() => setShowBlock(false)} title={t('blockTime')}>
          <div className="space-y-4">
            <Input id="block-date" label={t('date')} type="date" value={blockDate} onChange={(e) => setBlockDate(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <Input id="block-start" label={t('openTime')} type="time" value={blockStart} onChange={(e) => setBlockStart(e.target.value)} />
              <Input id="block-end" label={t('closeTime')} type="time" value={blockEnd} onChange={(e) => setBlockEnd(e.target.value)} />
            </div>
            <Input id="block-reason" label={zh ? '原因（選填）' : 'Reason (optional)'} value={blockReason} onChange={(e) => setBlockReason(e.target.value)} />
            <Button className="w-full" onClick={handleBlockTime} loading={blockSubmitting}>
              {t('confirm')}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── HELPERS ──────────────────────────────────────────────────────────────────

function greetingFor(now: Date, zh: boolean) {
  const h = now.getHours();
  if (zh) {
    if (h < 5) return '夜深了';
    if (h < 12) return '早晨';
    if (h < 17) return '午安';
    return '晚上好';
  }
  if (h < 5) return 'Late night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatCurrencyShort(n: number) {
  if (n === 0) return 'HK$0';
  if (n >= 1_000_000) return `HK$${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 10_000) return `HK$${(n / 1000).toFixed(0)}k`;
  if (n >= 1000) return `HK$${(n / 1000).toFixed(1)}k`;
  return `HK$${n}`;
}

function buildDailySeries(bookings: Booking[], days: number, now: Date) {
  const start = startOfDay(subDays(now, days - 1));
  const series = Array.from({ length: days }, (_, i) => {
    const d = startOfDay(subDays(now, days - 1 - i));
    return { date: d, count: 0, revenue: 0 };
  });
  for (const b of bookings) {
    const d = startOfDay(parseISO(b.booking_date));
    const idx = differenceInCalendarDays(d, start);
    if (idx < 0 || idx >= days) continue;
    series[idx].count += 1;
    if (b.status === 'completed') {
      const price = b.price_hkd ?? (b.service as Service | null)?.price_hkd ?? 0;
      series[idx].revenue += price;
    }
  }
  return series;
}

// ── PRIMITIVE BITS ───────────────────────────────────────────────────────────

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF] font-medium">{children}</p>
  );
}

function Pill({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[#3D3D3D]">
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {children}
    </span>
  );
}

function DeltaTag({ value, label }: { value: number; label: string }) {
  if (value === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] uppercase tracking-wider text-[#9CA3AF]">
        — {label}
      </span>
    );
  }
  const positive = value > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] uppercase tracking-wider ${
        positive ? 'text-[#0F766E]' : 'text-red-500'
      }`}
    >
      {positive ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
      {Math.abs(value)}% {label}
    </span>
  );
}

function LegendDot({ color, label, value, total }: { color: string; label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-1.5 text-[#3D3D3D]">
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
      <span className="text-[#6B7280] truncate flex-1">{label}</span>
      <span className="tabular-nums text-[#111111]">{value}</span>
      <span className="text-[#9CA3AF] tabular-nums w-7 text-right">{pct}%</span>
    </div>
  );
}

function EmptyHint({ children, icon }: { children: React.ReactNode; icon: React.ReactNode }) {
  return (
    <div className="text-center py-10 text-[#9CA3AF]">
      <div className="opacity-30 flex justify-center mb-3">{icon}</div>
      <p className="text-xs italic">{children}</p>
    </div>
  );
}

function DotPattern() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 opacity-[0.35] pointer-events-none"
      style={{
        backgroundImage: 'radial-gradient(#E5E7EB 1px, transparent 1px)',
        backgroundSize: '14px 14px',
        maskImage: 'radial-gradient(circle at top right, black, transparent 70%)',
        WebkitMaskImage: 'radial-gradient(circle at top right, black, transparent 70%)',
      }}
    />
  );
}

// ── SEGMENTED BAR (status mix) ───────────────────────────────────────────────

function SegmentedBar({ segments }: { segments: { value: number; color: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total === 0) {
    return <div className="h-2 rounded-full bg-[#F3F4F6]" />;
  }
  return (
    <div className="flex h-2 rounded-full overflow-hidden bg-[#F3F4F6]">
      {segments.map((s, i) =>
        s.value > 0 ? (
          <div
            key={i}
            className="h-full transition-all"
            style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
          />
        ) : null
      )}
    </div>
  );
}

// ── AREA SPARK (earnings hero) ───────────────────────────────────────────────

function AreaSpark({ data }: { data: number[] }) {
  const w = 100, h = 28;
  const max = Math.max(1, ...data);
  const step = data.length > 1 ? w / (data.length - 1) : w;
  const pts = data.map((v, i) => `${i * step},${h - (v / max) * h}`).join(' ');
  const area = `0,${h} ${pts} ${w},${h}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-12">
      <defs>
        <linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0F766E" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#0F766E" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#sparkfill)" />
      <polyline points={pts} fill="none" stroke="#0F766E" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// ── TREND CHART (30-day bookings) ────────────────────────────────────────────

function TrendChart({ data, zh }: { data: { date: Date; count: number }[]; zh: boolean }) {
  const w = 720, h = 160;
  const padX = 4, padY = 12;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;
  const max = Math.max(1, ...data.map((d) => d.count));
  const step = data.length > 1 ? innerW / (data.length - 1) : innerW;
  const points = data.map((d, i) => ({
    x: padX + i * step,
    y: padY + innerH - (d.count / max) * innerH,
    v: d.count,
    date: d.date,
  }));
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x},${padY + innerH} L${points[0].x},${padY + innerH} Z`;
  const avg = data.reduce((s, d) => s + d.count, 0) / data.length;
  const avgY = padY + innerH - (avg / max) * innerH;

  // Sparse x-axis ticks: every 7 days.
  const ticks = points.filter((_, i) => i % 7 === 0 || i === points.length - 1);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${w} ${h + 18}`} className="w-full h-auto">
        {/* horizontal grid */}
        {[0.25, 0.5, 0.75].map((p) => (
          <line
            key={p}
            x1={padX} x2={w - padX}
            y1={padY + innerH * p} y2={padY + innerH * p}
            stroke="#F3F4F6" strokeDasharray="2 4"
          />
        ))}
        {/* avg line */}
        <line x1={padX} x2={w - padX} y1={avgY} y2={avgY} stroke="#9CA3AF" strokeDasharray="3 3" strokeWidth="0.75" />
        <text x={w - padX} y={avgY - 3} textAnchor="end" fontSize="9" fill="#9CA3AF" letterSpacing="0.05em">
          {zh ? `平均 ${avg.toFixed(1)}` : `avg ${avg.toFixed(1)}`}
        </text>

        <defs>
          <linearGradient id="trendfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0F766E" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#0F766E" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#trendfill)" />
        <path d={linePath} fill="none" stroke="#0F766E" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />

        {/* Today dot */}
        {points.length > 0 && (
          <>
            <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="3.5" fill="#FFFFFF" stroke="#0F766E" strokeWidth="1.5" />
          </>
        )}

        {/* ticks */}
        {ticks.map((t, i) => (
          <text key={i} x={t.x} y={h + 12} textAnchor="middle" fontSize="9" fill="#9CA3AF" letterSpacing="0.05em">
            {format(t.date, zh ? 'M/d' : 'MMM d')}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ── HEATMAP ──────────────────────────────────────────────────────────────────

function Heatmap({ grid, max, zh }: { grid: number[][]; max: number; zh: boolean }) {
  const dayLabels = zh ? ['日', '一', '二', '三', '四', '五', '六'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex flex-col gap-1 min-w-full">
        {/* hour header */}
        <div className="flex gap-[3px] pl-9">
          {hours.map((h) => (
            <div key={h} className="flex-1 min-w-[16px] text-center text-[9px] text-[#9CA3AF] tabular-nums">
              {h % 3 === 0 ? h : ''}
            </div>
          ))}
        </div>
        {grid.map((row, dow) => (
          <div key={dow} className="flex items-center gap-[3px]">
            <div className="w-9 text-[10px] text-[#6B7280] uppercase tracking-wider">{dayLabels[dow]}</div>
            {row.map((v, hi) => {
              const intensity = max > 0 ? v / max : 0;
              const bg = intensity === 0
                ? '#F3F4F6'
                : `rgba(15, 118, 110, ${0.12 + intensity * 0.78})`;
              return (
                <div
                  key={hi}
                  title={`${dayLabels[dow]} ${hours[hi]}:00 — ${v} ${zh ? '個' : 'bookings'}`}
                  className="flex-1 min-w-[16px] aspect-square rounded-[3px] transition-colors hover:ring-1 hover:ring-[#0F766E]/40"
                  style={{ background: bg }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── TIMELINE (today's hour rail) ─────────────────────────────────────────────

function Timeline({
  bookings,
  now,
  onSelect,
}: {
  bookings: Booking[];
  now: Date;
  onSelect: (b: Booking) => void;
}) {
  const totalMins = (HOUR_END - HOUR_START) * 60;
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const inRange = nowMins >= HOUR_START * 60 && nowMins <= HOUR_END * 60;
  const nowPct = inRange ? ((nowMins - HOUR_START * 60) / totalMins) * 100 : null;

  if (bookings.length === 0) {
    return (
      <div className="relative">
        <HoursRail />
        <div className="text-center py-8 text-[#9CA3AF]">
          <CalendarCheck size={28} className="mx-auto mb-2 opacity-30" />
          <p className="text-xs italic">A clear day. Take a breath.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* MOBILE — vertical timeline */}
      <div className="lg:hidden">
        <VerticalTimeline bookings={bookings} now={now} onSelect={onSelect} />
      </div>

      {/* DESKTOP — horizontal hour rail */}
      <div className="hidden lg:block relative">
        <HoursRail />
        <div className="relative h-20">
          {bookings.map((b) => {
            const startM = timeToMinutes(b.start_time);
            const endM = timeToMinutes(b.end_time);
            const left = Math.max(0, ((startM - HOUR_START * 60) / totalMins) * 100);
            const width = Math.max(2.2, ((endM - startM) / totalMins) * 100);
            const color = STATUS_FILL[b.status] || '#0F766E';
            const isPast = endM <= nowMins;
            return (
              <button
                key={b.id}
                onClick={() => onSelect(b)}
                className="absolute top-1.5 bottom-1.5 rounded-md text-left px-2 py-1 text-[11px] font-medium text-white truncate hover:scale-[1.015] transition-transform shadow-sm cursor-pointer"
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  background: color,
                  opacity: isPast && b.status === 'confirmed' ? 0.55 : 1,
                }}
                title={`${formatTime(b.start_time)}–${formatTime(b.end_time)} · ${b.customer_name}`}
              >
                <div className="truncate">{b.customer_name}</div>
                <div className="text-[10px] opacity-80 truncate">{formatTime(b.start_time)}</div>
              </button>
            );
          })}

          {nowPct !== null && (
            <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: `${nowPct}%` }}>
              <div className="absolute -top-1.5 -left-1 w-2 h-2 rounded-full bg-[#0F766E] ring-2 ring-[#FAFAF8]" />
              <div className="absolute top-0 bottom-0 w-px bg-[#0F766E]" />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function VerticalTimeline({
  bookings,
  now,
  onSelect,
}: {
  bookings: Booking[];
  now: Date;
  onSelect: (b: Booking) => void;
}) {
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const sorted = [...bookings].sort(
    (a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time)
  );
  const nextIdx = sorted.findIndex(
    (b) => timeToMinutes(b.end_time) > nowMins && b.status === 'confirmed'
  );

  return (
    <div className="max-h-[480px] overflow-y-auto -mx-2 px-2">
      <div className="relative">
        {/* spine */}
        <div className="absolute left-[60px] top-2 bottom-2 w-px bg-[#E5E7EB]" />

        <div className="space-y-3">
          {sorted.map((b, i) => {
            const startM = timeToMinutes(b.start_time);
            const endM = timeToMinutes(b.end_time);
            const isPast = endM <= nowMins;
            const isNext = i === nextIdx;
            const color = STATUS_FILL[b.status] || '#0F766E';
            const badge = STATUS_BADGE[b.status];
            const showNowDivider =
              i > 0 &&
              nowMins >= timeToMinutes(sorted[i - 1].end_time) &&
              nowMins < startM;

            return (
              <div key={b.id}>
                {showNowDivider && (
                  <div className="flex items-center gap-2 mb-3 pl-[68px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0F766E] animate-pulse" />
                    <span className="text-[10px] uppercase tracking-[0.2em] text-[#0F766E]">
                      now · {format(now, 'h:mm a')}
                    </span>
                    <span className="flex-1 h-px bg-[#0F766E]/30" />
                  </div>
                )}

                <button
                  onClick={() => onSelect(b)}
                  className={`relative w-full flex items-stretch gap-4 text-left transition-opacity ${
                    isPast && b.status === 'confirmed' ? 'opacity-55' : ''
                  }`}
                >
                  {/* time column */}
                  <div className="w-[52px] shrink-0 pt-2 text-right">
                    <div className="text-[13px] font-semibold text-[#111111] tabular-nums leading-none">
                      {formatTime(b.start_time).replace(' ', '')}
                    </div>
                    <div className="text-[10px] text-[#9CA3AF] tabular-nums leading-none mt-1">
                      {formatTime(b.end_time).replace(' ', '')}
                    </div>
                  </div>

                  {/* node */}
                  <div className="relative w-[16px] shrink-0 flex items-start justify-center pt-3.5">
                    <div
                      className={`w-2.5 h-2.5 rounded-full ring-4 ring-white relative z-10 ${
                        isNext ? 'animate-pulse' : ''
                      }`}
                      style={{ background: color }}
                    />
                  </div>

                  {/* card */}
                  <div
                    className="flex-1 min-w-0 rounded-xl border border-[#E5E7EB] bg-white p-3 hover:border-[#0F766E]/40 transition-colors shadow-sm"
                    style={{ borderLeft: `3px solid ${color}` }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="font-semibold text-[14px] text-[#111111] truncate">
                        {b.customer_name}
                      </span>
                      <Badge variant={badge.variant}>
                        {badge.label_en}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-[11px] text-[#6B7280]">
                      {b.service && (
                        <span className="truncate">
                          {b.service.name_zh || b.service.name}
                        </span>
                      )}
                      {(b.price_hkd ?? b.service?.price_hkd ?? null) !== null && (
                        <span className="text-[#0F766E] font-medium">
                          {formatPrice(b.price_hkd ?? b.service?.price_hkd ?? null)}
                        </span>
                      )}
                      {b.customer_phone && (
                        <span className="truncate">· {b.customer_phone}</span>
                      )}
                    </div>
                  </div>
                </button>
              </div>
            );
          })}

          {/* trailing now-marker if all are past */}
          {nextIdx === -1 && nowMins > timeToMinutes(sorted[sorted.length - 1].end_time) && (
            <div className="flex items-center gap-2 pl-[68px] pt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0F766E]" />
              <span className="text-[10px] uppercase tracking-[0.2em] text-[#0F766E]">
                now · {format(now, 'h:mm a')}
              </span>
              <span className="flex-1 h-px bg-[#0F766E]/30" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HoursRail() {
  const hours = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);
  return (
    <div className="relative h-5 mb-1">
      <div className="absolute inset-x-0 top-3 h-px bg-[#E5E7EB]" />
      <div className="flex justify-between">
        {hours.map((h) => (
          <div key={h} className="flex flex-col items-center">
            <div className="w-px h-2 bg-[#E5E7EB]" />
            <span className="text-[9px] text-[#9CA3AF] mt-0.5 tabular-nums">{h % 12 === 0 ? 12 : h % 12}{h < 12 ? 'a' : 'p'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── BOOKING ROW (kept) ───────────────────────────────────────────────────────

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
      className={`flex items-center gap-2 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors border-l-4 ${STATUS_BORDER[booking.status]}`}
      onClick={() => onSelect(booking)}
    >
      <div className="w-14 shrink-0 flex flex-col items-end gap-1 pt-0.5">
        <span className="text-xs font-semibold text-on-surface leading-none">{formatTime(booking.start_time)}</span>
        <div className="w-px h-3 bg-border self-center" />
        <span className="text-xs text-muted leading-none">{formatTime(booking.end_time)}</span>
      </div>

      <div className="flex-1 min-w-0 pl-3">
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
  const zh = locale === 'zh-HK';
  const badge = STATUS_BADGE[booking.status];
  const accent = STATUS_FILL[booking.status] || '#0F766E';
  const serviceName = booking.service
    ? zh && booking.service.name_zh
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
  const displayPrice = priceInput ?? booking.service?.price_hkd ?? null;
  const hasPriceChanges = priceInput !== (booking.price_hkd ?? booking.service?.price_hkd ?? null);
  const hasNotesChanges = (ownerNotes.trim() || null) !== (booking.owner_notes ?? null);

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
          {(serviceName || displayPrice != null) && (
            <div className="rounded-xl border border-[#E5E7EB] bg-gradient-to-br from-white to-[#FAFAF8] p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF] mb-1">
                  {zh ? '服務' : 'Service'}
                </p>
                <p className="font-medium text-[15px] text-[#111111] truncate">
                  {serviceName || (zh ? '未指定' : 'Unspecified')}
                </p>
              </div>
              {displayPrice != null && (
                <div className="text-right shrink-0">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF] mb-1">
                    {zh ? '價格' : 'Price'}
                  </p>
                  <p className="font-display font-light text-2xl leading-none tabular-nums text-[#0F766E]">
                    {formatPrice(displayPrice)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* CUSTOMER NOTES */}
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

          {/* INTERNAL — owner editing */}
          <div className="rounded-xl border border-dashed border-[#D1D5DB] bg-white p-4 space-y-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9CA3AF] flex items-center gap-1.5">
              <PencilLine size={11} />
              {zh ? '內部資料 · 僅你可見' : 'Internal · only visible to you'}
            </p>

            {/* price editor */}
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
                disabled={!hasPriceChanges}
              >
                {zh ? '更新' : 'Update'}
              </Button>
            </div>

            {/* owner notes */}
            <div className="space-y-1.5">
              <label
                htmlFor={`booking-owner-notes-${booking.id}`}
                className="block text-xs font-medium text-[#3D3D3D]"
              >
                {zh ? '店主備注' : 'Owner Notes'}
              </label>
              <textarea
                id={`booking-owner-notes-${booking.id}`}
                value={ownerNotes}
                onChange={(e) => setOwnerNotes(e.target.value)}
                rows={3}
                placeholder={zh ? '加入內部備注...' : 'Add internal notes...'}
                className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-sm text-[#111111] placeholder:text-[#D1D5DB] transition-colors focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] resize-none"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={saveOwnerDetails}
                  loading={savingOwnerDetails}
                  disabled={!hasNotesChanges}
                >
                  {zh ? '儲存備注' : 'Save Notes'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER ACTIONS */}
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
              onClick={() => {
                if (confirm(t('cancelConfirm'))) onUpdateStatus(booking.id, 'cancelled');
              }}
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
