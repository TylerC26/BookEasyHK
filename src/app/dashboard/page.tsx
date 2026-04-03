'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n/context';
import { Card, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { formatTime, formatPrice, addMinutesToTime } from '@/lib/utils';
import type { Booking, Business, Service } from '@/lib/types';
import { format, isToday, isTomorrow, isAfter, parseISO } from 'date-fns';
import { CalendarCheck, Clock, AlertTriangle, Plus, X, UserCheck } from 'lucide-react';

const STATUS_BADGE: Record<string, { variant: 'default' | 'success' | 'warning' | 'danger' | 'muted'; label_zh: string; label_en: string }> = {
  confirmed: { variant: 'default', label_zh: '已確認', label_en: 'Confirmed' },
  completed: { variant: 'success', label_zh: '已完成', label_en: 'Completed' },
  no_show: { variant: 'danger', label_zh: '爽約', label_en: 'No-Show' },
  cancelled: { variant: 'muted', label_zh: '已取消', label_en: 'Cancelled' },
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
      .select('*, service:services(*)')
      .eq('business_id', biz.id)
      .eq('booking_date', today)
      .neq('status', 'cancelled')
      .order('start_time');

    setTodayBookings(todayData || []);

    const { data: upcomingData } = await supabase
      .from('bookings')
      .select('*, service:services(*)')
      .eq('business_id', biz.id)
      .gt('booking_date', today)
      .neq('status', 'cancelled')
      .order('booking_date')
      .order('start_time')
      .limit(20);

    setUpcomingBookings(upcomingData || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const updateBookingStatus = async (bookingId: string, status: string) => {
    const supabase = createClient();
    await supabase.from('bookings').update({ status }).eq('id', bookingId);
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

  const stats = {
    today: todayBookings.length,
    upcoming: upcomingBookings.length,
    noShowRate: todayBookings.length > 0
      ? Math.round((todayBookings.filter((b) => b.status === 'no_show').length / todayBookings.length) * 100)
      : 0,
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted">{t('loading')}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('dashboard')}</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowBlock(true)}>
            {t('blockTime')}
          </Button>
          <Button size="sm" onClick={() => setShowManual(true)}>
            <Plus size={16} /> {t('manualBooking')}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="flex items-center gap-4">
          <div className="w-10 h-10 bg-primary-light rounded-xl flex items-center justify-center">
            <CalendarCheck size={20} className="text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.today}</p>
            <p className="text-xs text-muted">{t('todayCount')}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
            <Clock size={20} className="text-amber-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.upcoming}</p>
            <p className="text-xs text-muted">{t('upcoming')}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
            <AlertTriangle size={20} className="text-red-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.noShowRate}%</p>
            <p className="text-xs text-muted">{t('noShowRate')}</p>
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
                t={t}
              />
            ))}
          </div>
        )}
      </Card>

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
  t,
}: {
  booking: Booking;
  locale: string;
  showDate?: boolean;
  onUpdateStatus: (id: string, status: string) => void;
  t: (key: string) => string;
}) {
  const badge = STATUS_BADGE[booking.status];
  const serviceName = booking.service
    ? locale === 'zh-HK' && booking.service.name_zh
      ? booking.service.name_zh
      : booking.service.name
    : '';

  return (
    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm truncate">{booking.customer_name}</span>
          {booking.is_manual && (
            <Badge variant="muted">
              {locale === 'zh-HK' ? '手動' : 'Manual'}
            </Badge>
          )}
          <Badge variant={badge.variant}>
            {locale === 'zh-HK' ? badge.label_zh : badge.label_en}
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted">
          {showDate && <span>{format(parseISO(booking.booking_date), 'MMM d')}</span>}
          <span>{formatTime(booking.start_time)} – {formatTime(booking.end_time)}</span>
          {serviceName && <span>· {serviceName}</span>}
        </div>
      </div>
      {booking.status === 'confirmed' && (
        <div className="flex gap-1 ml-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onUpdateStatus(booking.id, 'completed')}
            title={t('markDone')}
          >
            <UserCheck size={16} className="text-emerald-600" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onUpdateStatus(booking.id, 'no_show')}
            title={t('markNoShow')}
          >
            <AlertTriangle size={16} className="text-amber-500" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm(t('cancelConfirm'))) {
                onUpdateStatus(booking.id, 'cancelled');
              }
            }}
            title={t('cancelBooking')}
          >
            <X size={16} className="text-red-500" />
          </Button>
        </div>
      )}
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
