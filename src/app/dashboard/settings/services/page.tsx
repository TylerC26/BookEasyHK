'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n/context';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Business, Service } from '@/lib/types';

export default function ServicesSettingsPage() {
  const { t, locale } = useI18n();
  const [business, setBusiness] = useState<Business | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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

    const { data: svc } = await supabase
      .from('services')
      .select('*')
      .eq('business_id', biz.id)
      .order('sort_order');
    setServices(svc || []);
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
    for (const svc of services) {
      if (svc.id.startsWith('new-')) {
        await supabase.from('services').insert({
          business_id: business.id,
          name: svc.name,
          name_zh: svc.name_zh,
          duration_minutes: svc.duration_minutes,
          price_hkd: svc.price_hkd,
          active: svc.active,
          sort_order: svc.sort_order,
        });
      } else {
        await supabase
          .from('services')
          .update({
            name: svc.name,
            name_zh: svc.name_zh,
            duration_minutes: svc.duration_minutes,
            price_hkd: svc.price_hkd,
            active: svc.active,
          })
          .eq('id', svc.id);
      }
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    loadData();
  };

  const addService = () => {
    setServices([
      ...services,
      {
        id: `new-${Date.now()}`,
        business_id: business?.id || '',
        name: '',
        name_zh: null,
        duration_minutes: 60,
        price_hkd: null,
        active: true,
        sort_order: services.length,
        created_at: new Date().toISOString(),
      },
    ]);
  };

  const removeService = async (idx: number) => {
    const svc = services[idx];
    if (!svc.id.startsWith('new-')) {
      const supabase = createClient();
      await supabase.from('services').update({ active: false }).eq('id', svc.id);
    }
    setServices(services.filter((_, i) => i !== idx));
  };

  const updateService = (idx: number, field: string, value: string | number | boolean | null) => {
    const updated = [...services];
    (updated[idx] as unknown as Record<string, unknown>)[field] = value;
    setServices(updated);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted">{t('loading')}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{locale === 'zh-HK' ? '服務設定' : 'Services Settings'}</h1>
        <Button onClick={handleSave} loading={saving}>
          <Save size={16} />
          {saved ? t('success') : t('save')}
        </Button>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardTitle>{t('step2Title')}</CardTitle>
          <Button variant="outline" size="sm" onClick={addService}>
            <Plus size={16} /> {t('addService')}
          </Button>
        </div>
        <div className="space-y-3">
          {services.map((svc, idx) => (
            <div key={svc.id} className="p-4 bg-slate-50 rounded-xl">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <Input
                  id={`svc-${idx}-name`}
                  label={t('serviceName')}
                  value={svc.name}
                  onChange={(e) => updateService(idx, 'name', e.target.value)}
                />
                <Input
                  id={`svc-${idx}-zh`}
                  label={t('serviceNameZh')}
                  value={svc.name_zh || ''}
                  onChange={(e) => updateService(idx, 'name_zh', e.target.value)}
                />
                <Input
                  id={`svc-${idx}-dur`}
                  label={t('duration')}
                  type="number"
                  min={15}
                  step={15}
                  value={svc.duration_minutes}
                  onChange={(e) => updateService(idx, 'duration_minutes', parseInt(e.target.value) || 60)}
                />
                <div className="flex items-end gap-2">
                  <Input
                    id={`svc-${idx}-price`}
                    label={t('price')}
                    type="number"
                    min={0}
                    value={svc.price_hkd ?? ''}
                    onChange={(e) => updateService(idx, 'price_hkd', parseInt(e.target.value) || null)}
                  />
                  <button
                    onClick={() => removeService(idx)}
                    className="h-10 px-2 text-danger hover:bg-red-50 rounded-lg cursor-pointer"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {services.length === 0 && (
            <p className="text-sm text-muted text-center py-6">
              {locale === 'zh-HK' ? '尚未新增任何服務' : 'No services added yet'}
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
