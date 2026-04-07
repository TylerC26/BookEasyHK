'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n/context';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { formatTime } from '@/lib/utils';
import type { Booking } from '@/lib/types';
import {
  format, parseISO, subDays,
  startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, isSameDay, addMonths, subMonths,
} from 'date-fns';
import { UserCheck, AlertTriangle, X, List, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

const STATUS_BADGE: Record<string, { variant: 'default' | 'success' | 'warning' | 'danger' | 'muted'; label_zh: string; label_en: string }> = {
  pending: { variant: 'warning', label_zh: '待確認', label_en: 'Pending' },
  confirmed: { variant: 'default', label_zh: '已確認', label_en: 'Confirmed' },
  completed: { variant: 'success', label_zh: '已完成', label_en: 'Completed' },
  no_show: { variant: 'danger', label_zh: '爽約', label_en: 'No-Show' },
  cancelled: { variant: 'muted', label_zh: '已取消', label_en: 'Cancelled' },
};

export default function BookingsPage() {
  const { t, locale } = useI18n();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [statusFilter, setStatusFilter] = useState('all');

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
      .select('*, service:services(*)')
      .eq('business_id', biz.id)
      .gte('booking_date', dateFrom)
      .lte('booking_date', dateTo)
      .order('booking_date', { ascending: false })
      .order('start_time', { ascending: false });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data } = await query.limit(100);
    setBookings(data || []);
    setLoading(false);
  }, [dateFrom, dateTo, statusFilter]);

  useEffect(() => {
    const run = async () => {
      await loadBookings();
    };

    void run();
  }, [loadBookings]);

  const updateStatus = async (id: string, status: string) => {
    const supabase = createClient();
    await supabase.from('bookings').update({ status }).eq('id', id);
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
    setDateFrom(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
    setDateTo(format(new Date(), 'yyyy-MM-dd'));
    setView('list');
  };

  const navigateCalendar = (dir: 'prev' | 'next') => {
    const newDate = dir === 'prev' ? subMonths(calendarDate, 1) : addMonths(calendarDate, 1);
    setCalendarDate(newDate);
    setDateFrom(format(startOfMonth(newDate), 'yyyy-MM-dd'));
    setDateTo(format(endOfMonth(newDate), 'yyyy-MM-dd'));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('bookingHistory')}</h1>
        <div className="flex gap-1 p-1 bg-surface neomorph-inset rounded-xl">
          <button
            onClick={switchToList}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${view === 'list' ? 'bg-white shadow text-primary' : 'text-muted hover:text-on-surface'}`}
          >
            <List size={15} />
            {locale === 'zh-HK' ? '列表' : 'List'}
          </button>
          <button
            onClick={switchToCalendar}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${view === 'calendar' ? 'bg-white shadow text-primary' : 'text-muted hover:text-on-surface'}`}
          >
            <CalendarDays size={15} />
            {locale === 'zh-HK' ? '月曆' : 'Calendar'}
          </button>
        </div>
      </div>

      {/* Filters — list view only */}
      {view === 'list' && (
        <Card>
          <div className="flex flex-wrap items-end gap-4">
            <Input
              id="date-from"
              label={locale === 'zh-HK' ? '由' : 'From'}
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
            <Input
              id="date-to"
              label={locale === 'zh-HK' ? '至' : 'To'}
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-secondary">{t('status')}</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 px-3 rounded-xl border border-border bg-white text-sm"
              >
                <option value="all">{locale === 'zh-HK' ? '全部' : 'All'}</option>
                <option value="pending">{locale === 'zh-HK' ? '待確認' : 'Pending'}</option>
                <option value="confirmed">{locale === 'zh-HK' ? '已確認' : 'Confirmed'}</option>
                <option value="completed">{locale === 'zh-HK' ? '已完成' : 'Completed'}</option>
                <option value="no_show">{locale === 'zh-HK' ? '爽約' : 'No-Show'}</option>
                <option value="cancelled">{locale === 'zh-HK' ? '已取消' : 'Cancelled'}</option>
              </select>
            </div>
          </div>
        </Card>
      )}

      {/* Calendar view */}
      {view === 'calendar' && (
        <CalendarView
          bookings={bookings}
          calendarDate={calendarDate}
          loading={loading}
          onPrev={() => navigateCalendar('prev')}
          onNext={() => navigateCalendar('next')}
          onSelectBooking={setSelectedBooking}
          locale={locale}
        />
      )}

      {/* Bookings list */}
      {view === 'list' && <Card>
        {loading ? (
          <div className="text-center py-8 text-muted">{t('loading')}</div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-8 text-muted">
            {locale === 'zh-HK' ? '暫無紀錄' : 'No bookings found'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="pb-3 font-medium">{t('date')}</th>
                  <th className="pb-3 font-medium">{t('time')}</th>
                  <th className="pb-3 font-medium">{t('customerName')}</th>
                  <th className="pb-3 font-medium">{t('service')}</th>
                  <th className="pb-3 font-medium">{t('status')}</th>
                  <th className="pb-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bookings.map((b) => {
                  const badge = STATUS_BADGE[b.status];
                  const svcName = b.service
                    ? locale === 'zh-HK' && b.service.name_zh ? b.service.name_zh : b.service.name
                    : '—';

                  return (
                    <tr
                      key={b.id}
                      className="cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => setSelectedBooking(b)}
                    >
                      <td className="py-3">{format(parseISO(b.booking_date), 'MMM d')}</td>
                      <td className="py-3">{formatTime(b.start_time)}</td>
                      <td className="py-3 font-medium">
                        {b.customer_name}
                        {b.is_manual && <span className="text-xs text-muted ml-1">(M)</span>}
                      </td>
                      <td className="py-3 text-muted">{svcName}</td>
                      <td className="py-3">
                        <Badge variant={badge.variant}>
                          {locale === 'zh-HK' ? badge.label_zh : badge.label_en}
                        </Badge>
                      </td>
                      <td className="py-3" onClick={(e) => e.stopPropagation()}>
                        {b.status === 'confirmed' && (
                          <div className="flex gap-1">
                            <button onClick={() => updateStatus(b.id, 'completed')} className="p-1 hover:bg-emerald-50 rounded cursor-pointer" title={t('markDone')}>
                              <UserCheck size={16} className="text-emerald-600" />
                            </button>
                            <button onClick={() => updateStatus(b.id, 'no_show')} className="p-1 hover:bg-amber-50 rounded cursor-pointer" title={t('markNoShow')}>
                              <AlertTriangle size={16} className="text-amber-500" />
                            </button>
                            <button onClick={() => { if (confirm(t('cancelConfirm'))) updateStatus(b.id, 'cancelled'); }} className="p-1 hover:bg-red-50 rounded cursor-pointer" title={t('cancelBooking')}>
                              <X size={16} className="text-red-500" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>}

      {selectedBooking && (
        <BookingDetailModal
          booking={selectedBooking}
          locale={locale}
          onClose={() => setSelectedBooking(null)}
          onUpdateStatus={(id, status) => { updateStatus(id, status); setSelectedBooking(null); }}
          t={t}
        />
      )}
    </div>
  );
}

const STATUS_CHIP: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  confirmed: 'bg-primary/10 text-primary',
  completed: 'bg-emerald-50 text-emerald-700',
  no_show: 'bg-red-50 text-red-600',
  cancelled: 'bg-slate-100 text-slate-500',
};

function CalendarView({
  bookings,
  calendarDate,
  loading,
  onPrev,
  onNext,
  onSelectBooking,
  locale,
}: {
  bookings: Booking[];
  calendarDate: Date;
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSelectBooking: (b: Booking) => void;
  locale: string;
}) {
  const firstDay = startOfMonth(calendarDate);
  const days = eachDayOfInterval({ start: firstDay, end: endOfMonth(calendarDate) });
  const startOffset = getDay(firstDay);
  const cells: (Date | null)[] = [...Array(startOffset).fill(null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);

  const dayHeaders = locale === 'zh-HK'
    ? ['日', '一', '二', '三', '四', '五', '六']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const today = new Date();

  return (
    <Card>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-5">
        <button onClick={onPrev} className="p-2 rounded-lg hover:bg-surface transition-colors cursor-pointer">
          <ChevronLeft size={18} />
        </button>
        <span className="font-semibold text-base">
          {format(calendarDate, locale === 'zh-HK' ? 'yyyy年 M月' : 'MMMM yyyy')}
        </span>
        <button onClick={onNext} className="p-2 rounded-lg hover:bg-surface transition-colors cursor-pointer">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {dayHeaders.map((d) => (
          <div key={d} className="text-center text-xs text-muted font-medium py-1">{d}</div>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-center py-12 text-muted text-sm">{locale === 'zh-HK' ? '載入中...' : 'Loading...'}</div>
      ) : (
        <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden">
          {cells.map((day, i) => {
            if (!day) {
              return <div key={i} className="bg-surface-dim min-h-[90px]" />;
            }
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayBookings = bookings.filter((b) => b.booking_date === dateStr);
            const isToday = isSameDay(day, today);

            return (
              <div key={i} className="bg-card min-h-[90px] p-1.5">
                <div className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-1 ${isToday ? 'bg-primary text-white' : 'text-on-surface'}`}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-0.5">
                  {dayBookings.slice(0, 3).map((b) => (
                    <button
                      key={b.id}
                      onClick={() => onSelectBooking(b)}
                      className={`w-full text-left text-xs px-1.5 py-0.5 rounded truncate cursor-pointer ${STATUS_CHIP[b.status]}`}
                    >
                      {formatTime(b.start_time)} {b.customer_name}
                    </button>
                  ))}
                  {dayBookings.length > 3 && (
                    <div className="text-xs text-muted px-1.5">+{dayBookings.length - 3}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
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
  onUpdateStatus: (id: string, status: string) => void;
  t: ReturnType<typeof useI18n>['t'];
}) {
  const badge = STATUS_BADGE[booking.status];
  const serviceName = booking.service
    ? locale === 'zh-HK' && booking.service.name_zh
      ? booking.service.name_zh
      : booking.service.name
    : null;

  const rows: { label: string; value: string }[] = [
    { label: locale === 'zh-HK' ? '日期' : 'Date', value: format(parseISO(booking.booking_date), 'MMM d, yyyy') },
    { label: locale === 'zh-HK' ? '時間' : 'Time', value: `${formatTime(booking.start_time)} – ${formatTime(booking.end_time)}` },
    ...(serviceName ? [{ label: locale === 'zh-HK' ? '服務' : 'Service', value: serviceName }] : []),
    ...(booking.customer_phone ? [{ label: locale === 'zh-HK' ? '電話' : 'Phone', value: booking.customer_phone }] : []),
    ...(booking.customer_whatsapp ? [{ label: 'WhatsApp', value: booking.customer_whatsapp }] : []),
    ...(booking.customer_email ? [{ label: 'Email', value: booking.customer_email }] : []),
    ...(booking.customer_notes ? [{ label: locale === 'zh-HK' ? '備注' : 'Notes', value: booking.customer_notes }] : []),
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between p-6 pb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-semibold">{booking.customer_name}</h3>
              {booking.is_manual && (
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                  {locale === 'zh-HK' ? '手動' : 'Manual'}
                </span>
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
          {rows.map((row) => (
            <div key={row.label} className="flex items-start gap-3 text-sm">
              <span className="text-muted w-20 shrink-0">{row.label}</span>
              <span className="font-medium">{row.value}</span>
            </div>
          ))}
        </div>

        {booking.status === 'pending' && (
          <div className="flex gap-2 px-6 pb-6 pt-2 border-t border-border mt-2">
            <button
              onClick={() => onUpdateStatus(booking.id, 'confirmed')}
              className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-2 rounded-xl bg-primary text-white hover:opacity-90 transition-colors cursor-pointer"
            >
              <UserCheck size={15} />
              {t('confirmBookingRequest')}
            </button>
            <button
              onClick={() => { if (confirm(t('cancelConfirm'))) onUpdateStatus(booking.id, 'cancelled'); }}
              className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-2 rounded-xl border border-border hover:bg-red-50 transition-colors cursor-pointer"
            >
              <X size={15} className="text-red-500" />
              {locale === 'zh-HK' ? '取消' : 'Cancel'}
            </button>
          </div>
        )}

        {booking.status === 'confirmed' && (
          <div className="flex gap-2 px-6 pb-6 pt-2 border-t border-border mt-2">
            <button
              onClick={() => onUpdateStatus(booking.id, 'completed')}
              className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-2 rounded-xl border border-border hover:bg-emerald-50 transition-colors cursor-pointer"
            >
              <UserCheck size={15} className="text-emerald-600" />
              {locale === 'zh-HK' ? '完成' : 'Done'}
            </button>
            <button
              onClick={() => onUpdateStatus(booking.id, 'no_show')}
              className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-2 rounded-xl border border-border hover:bg-amber-50 transition-colors cursor-pointer"
            >
              <AlertTriangle size={15} className="text-amber-500" />
              {locale === 'zh-HK' ? '爽約' : 'No-Show'}
            </button>
            <button
              onClick={() => { if (confirm(t('cancelConfirm'))) onUpdateStatus(booking.id, 'cancelled'); }}
              className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-2 rounded-xl border border-border hover:bg-red-50 transition-colors cursor-pointer"
            >
              <X size={15} className="text-red-500" />
              {locale === 'zh-HK' ? '取消' : 'Cancel'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
