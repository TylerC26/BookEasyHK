'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n/context';
import { Card, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatTime } from '@/lib/utils';
import type { Booking } from '@/lib/types';
import { format, parseISO, subDays } from 'date-fns';
import { UserCheck, AlertTriangle, X } from 'lucide-react';

const STATUS_BADGE: Record<string, { variant: 'default' | 'success' | 'warning' | 'danger' | 'muted'; label_zh: string; label_en: string }> = {
  confirmed: { variant: 'default', label_zh: '已確認', label_en: 'Confirmed' },
  completed: { variant: 'success', label_zh: '已完成', label_en: 'Completed' },
  no_show: { variant: 'danger', label_zh: '爽約', label_en: 'No-Show' },
  cancelled: { variant: 'muted', label_zh: '已取消', label_en: 'Cancelled' },
};

export default function BookingsPage() {
  const { t, locale } = useI18n();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => { loadBookings(); }, [loadBookings]);

  const updateStatus = async (id: string, status: string) => {
    const supabase = createClient();
    await supabase.from('bookings').update({ status }).eq('id', id);
    loadBookings();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('bookingHistory')}</h1>

      {/* Filters */}
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
              <option value="confirmed">{locale === 'zh-HK' ? '已確認' : 'Confirmed'}</option>
              <option value="completed">{locale === 'zh-HK' ? '已完成' : 'Completed'}</option>
              <option value="no_show">{locale === 'zh-HK' ? '爽約' : 'No-Show'}</option>
              <option value="cancelled">{locale === 'zh-HK' ? '已取消' : 'Cancelled'}</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Bookings list */}
      <Card>
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
                    <tr key={b.id}>
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
                      <td className="py-3">
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
      </Card>
    </div>
  );
}
