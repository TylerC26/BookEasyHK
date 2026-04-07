'use client';

import { useEffect, useState, useCallback } from 'react';
import { Save } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n/context';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Business, WorkingHours } from '@/lib/types';

const DAY_LABELS_ZH = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const DAY_LABELS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function BusinessSettingsPage() {
  const { t, locale } = useI18n();
  const [business, setBusiness] = useState<Business | null>(null);
  const [hours, setHours] = useState<WorkingHours[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [bufferMinutes, setBufferMinutes] = useState(0);
  const [minAdvanceHours, setMinAdvanceHours] = useState(2);
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(30);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: biz } = await supabase
      .from('businesses')
      .select('*')
      .eq('owner_id', user.id)
      .single();
    if (!biz) return;

    setBusiness(biz);
    setName(biz.name);
    setPhone(biz.phone || '');
    setWhatsapp(biz.whatsapp || '');
    setBufferMinutes(biz.buffer_minutes);
    setMinAdvanceHours(biz.min_advance_hours);
    setMaxAdvanceDays(biz.max_advance_days);

    const { data: wh } = await supabase
      .from('working_hours')
      .select('*')
      .eq('business_id', biz.id)
      .order('day_of_week');
    setHours(wh || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    if (!business) return;
    setSaving(true);
    setSaved(false);

    const supabase = createClient();
    await supabase
      .from('businesses')
      .update({
        name,
        phone,
        whatsapp,
        buffer_minutes: bufferMinutes,
        min_advance_hours: minAdvanceHours,
        max_advance_days: maxAdvanceDays,
      })
      .eq('id', business.id);

    for (const wh of hours) {
      await supabase
        .from('working_hours')
        .update({
          is_open: wh.is_open,
          open_time: wh.is_open ? wh.open_time : null,
          close_time: wh.is_open ? wh.close_time : null,
          break_start: wh.is_open ? wh.break_start : null,
          break_end: wh.is_open ? wh.break_end : null,
        })
        .eq('id', wh.id);
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    loadData();
  };

  const dayLabels = locale === 'zh-HK' ? DAY_LABELS_ZH : DAY_LABELS_EN;

  const updateHour = (idx: number, field: string, value: string | boolean) => {
    const updated = [...hours];
    (updated[idx] as unknown as Record<string, unknown>)[field] = value;
    setHours(updated);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted">{t('loading')}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{locale === 'zh-HK' ? '商戶設定' : 'Business Settings'}</h1>
        <Button onClick={handleSave} loading={saving}>
          <Save size={16} />
          {saved ? t('success') : t('save')}
        </Button>
      </div>

      <Card>
        <CardTitle className="mb-4">{locale === 'zh-HK' ? '商戶資料' : 'Business Info'}</CardTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input id="biz-name" label={t('businessName')} value={name} onChange={(e) => setName(e.target.value)} />
          <Input id="biz-phone" label={t('phone')} value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input id="biz-wa" label={t('whatsappNumber')} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
          <Input
            id="biz-slug"
            label={t('bookingSlug')}
            value={business?.slug || ''}
            disabled
            hint={`bookeasyhk.com/${business?.slug}`}
          />
        </div>
      </Card>

      <Card>
        <CardTitle className="mb-4">
          {locale === 'zh-HK' ? '預約設定' : 'Booking Settings'}
        </CardTitle>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            id="buffer"
            label={locale === 'zh-HK' ? '預約間隔（分鐘）' : 'Buffer Time (mins)'}
            type="number"
            min={0}
            value={bufferMinutes}
            onChange={(e) => setBufferMinutes(parseInt(e.target.value) || 0)}
          />
          <Input
            id="min-advance"
            label={locale === 'zh-HK' ? '最少提前（小時）' : 'Min Advance (hours)'}
            type="number"
            min={0}
            value={minAdvanceHours}
            onChange={(e) => setMinAdvanceHours(parseInt(e.target.value) || 0)}
          />
          <Input
            id="max-advance"
            label={locale === 'zh-HK' ? '最遠預約（日）' : 'Max Advance (days)'}
            type="number"
            min={1}
            value={maxAdvanceDays}
            onChange={(e) => setMaxAdvanceDays(parseInt(e.target.value) || 30)}
          />
        </div>
      </Card>

      <Card>
        <CardTitle className="mb-4">{t('workingHours')}</CardTitle>
        <div className="space-y-3">
          {hours.map((h, idx) => (
            <div key={h.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
              <div className="w-16 text-sm font-medium">{dayLabels[h.day_of_week]}</div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={h.is_open}
                  onChange={(e) => updateHour(idx, 'is_open', e.target.checked)}
                  className="rounded"
                />
              </label>
              {h.is_open && (
                <div className="flex items-center gap-2 flex-1 flex-wrap">
                  <input
                    type="time"
                    value={h.open_time || '10:00'}
                    onChange={(e) => updateHour(idx, 'open_time', e.target.value)}
                    className="h-8 px-2 text-xs border border-border rounded-lg bg-white"
                  />
                  <span className="text-xs text-muted">–</span>
                  <input
                    type="time"
                    value={h.close_time || '20:00'}
                    onChange={(e) => updateHour(idx, 'close_time', e.target.value)}
                    className="h-8 px-2 text-xs border border-border rounded-lg bg-white"
                  />
                </div>
              )}
              {!h.is_open && <span className="text-xs text-muted">{t('dayOff')}</span>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
