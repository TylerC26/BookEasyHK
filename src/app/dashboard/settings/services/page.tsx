'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Save, Trash2, ImagePlus, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n/context';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { uploadBusinessImage } from '@/lib/business-images';
import { getBusinessTypeEmoji } from '@/lib/utils';
import type { Business, Service } from '@/lib/types';

export default function ServicesSettingsPage() {
  const { t, locale } = useI18n();
  const [business, setBusiness] = useState<Business | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState('');

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
    setSaveError('');

    const supabase = createClient();
    for (const svc of services) {
      if (svc.id.startsWith('new-')) {
        const { error } = await supabase.from('services').insert({
          business_id: business.id,
          name: svc.name,
          name_zh: svc.name_zh,
          duration_minutes: svc.duration_minutes,
          price_hkd: svc.pricing_type === 'tbc' ? null : svc.price_hkd,
          pricing_type: svc.pricing_type,
          active: svc.active,
          sort_order: svc.sort_order,
          allow_customer_image: svc.allow_customer_image,
          image_url: svc.image_url,
        });
        if (error) {
          setSaveError(error.message);
          setSaving(false);
          return;
        }
      } else {
        const { error } = await supabase
          .from('services')
          .update({
            name: svc.name,
            name_zh: svc.name_zh,
            duration_minutes: svc.duration_minutes,
            price_hkd: svc.pricing_type === 'tbc' ? null : svc.price_hkd,
            pricing_type: svc.pricing_type,
            active: svc.active,
            allow_customer_image: svc.allow_customer_image,
            image_url: svc.image_url,
          })
          .eq('id', svc.id);
        if (error) {
          setSaveError(error.message);
          setSaving(false);
          return;
        }
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
        pricing_type: 'fixed',
        active: true,
        sort_order: services.length,
        allow_customer_image: false,
        image_url: null,
        created_at: new Date().toISOString(),
      },
    ]);
  };

  const handleImageUpload = async (idx: number, file: File) => {
    setUploadError('');
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploadError('Not signed in.'); return; }
    setUploadingIdx(idx);
    try {
      const url = await uploadBusinessImage(supabase, user.id, file);
      updateService(idx, 'image_url', url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploadingIdx(null);
    }
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
      {saveError && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
          <strong>Save failed:</strong> {saveError}
        </div>
      )}

      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardTitle>{t('step2Title')}</CardTitle>
          <Button variant="outline" size="sm" onClick={addService}>
            <Plus size={16} /> {t('addService')}
          </Button>
        </div>
        <div className="space-y-3">
          {services.map((svc, idx) => (
            <div key={svc.id} className="p-4 bg-slate-50 rounded-xl space-y-3">
              {/* Service image (optional) */}
              <div className="flex items-start gap-3">
                <div className="shrink-0">
                  <label
                    className="relative block w-20 h-20 rounded-xl overflow-hidden border-2 border-dashed border-slate-300 bg-white cursor-pointer hover:border-[#0F766E] transition-colors group"
                  >
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingIdx === idx}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(idx, file);
                        e.target.value = '';
                      }}
                    />
                    {svc.image_url ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={svc.image_url}
                          alt={svc.name || 'Service'}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                          <ImagePlus size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </>
                    ) : uploadingIdx === idx ? (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-500 animate-pulse">
                        {locale === 'zh-HK' ? '上傳中...' : 'Uploading…'}
                      </div>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-0.5 text-slate-400">
                        <span className="text-2xl" aria-hidden>{getBusinessTypeEmoji(business?.type || '')}</span>
                        <span className="text-[9px] font-medium">{locale === 'zh-HK' ? '加圖片' : 'Add photo'}</span>
                      </div>
                    )}
                  </label>
                  {svc.image_url && (
                    <button
                      type="button"
                      onClick={() => updateService(idx, 'image_url', null)}
                      className="mt-1 w-full flex items-center justify-center gap-1 text-[10px] text-slate-500 hover:text-red-500 transition-colors"
                    >
                      <X size={10} />
                      {locale === 'zh-HK' ? '移除' : 'Remove'}
                    </button>
                  )}
                </div>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                  <div className="flex-1 space-y-1.5">
                    <label htmlFor={`svc-${idx}-price`} className="block text-sm font-medium text-secondary">
                      {t('price')}
                    </label>
                    <input
                      id={`svc-${idx}-price`}
                      type="number"
                      min={0}
                      disabled={svc.pricing_type === 'tbc'}
                      value={svc.pricing_type === 'tbc' ? '' : (svc.price_hkd ?? '')}
                      placeholder={svc.pricing_type === 'tbc' ? (locale === 'zh-HK' ? '待確認' : 'TBC') : ''}
                      onChange={(e) => updateService(idx, 'price_hkd', parseInt(e.target.value) || null)}
                      className="w-full h-10 px-3 rounded-xl border border-border bg-white text-sm disabled:bg-slate-100 disabled:text-muted disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <button
                    onClick={() => removeService(idx)}
                    className="h-10 px-2 text-danger hover:bg-red-50 rounded-lg cursor-pointer"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                </div>
              </div>

              {uploadError && uploadingIdx === null && (
                <p className="text-xs text-red-500">{uploadError}</p>
              )}

              {/* Per-service options */}
              <div className="pt-2 border-t border-slate-200 space-y-3">
                {/* Pricing type */}
                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-600">
                    <div className="font-medium">{locale === 'zh-HK' ? '定價方式' : 'Pricing'}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {svc.pricing_type === 'tbc'
                        ? (locale === 'zh-HK' ? '確認預約時再輸入最終價格' : 'Set the final price when confirming each booking')
                        : (locale === 'zh-HK' ? '以上方價格收費' : 'Charge the price above for every booking')}
                    </div>
                  </div>
                  <div className="flex gap-0.5 p-0.5 bg-white border border-slate-200 rounded-lg shrink-0">
                    <button
                      type="button"
                      onClick={() => updateService(idx, 'pricing_type', 'fixed')}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                        svc.pricing_type !== 'tbc' ? 'bg-[#0F766E] text-white' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {locale === 'zh-HK' ? '固定' : 'Fixed'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        updateService(idx, 'pricing_type', 'tbc');
                        updateService(idx, 'price_hkd', null);
                      }}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                        svc.pricing_type === 'tbc' ? 'bg-[#0F766E] text-white' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      TBC
                    </button>
                  </div>
                </div>

                {/* Customer image upload */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <ImagePlus size={15} className="text-slate-400" />
                    <span>{locale === 'zh-HK' ? '允許客戶上傳圖片' : 'Allow customer image upload'}</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={svc.allow_customer_image}
                    onClick={() => updateService(idx, 'allow_customer_image', !svc.allow_customer_image)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                      svc.allow_customer_image ? 'bg-[#0F766E]' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                        svc.allow_customer_image ? 'translate-x-[18px]' : 'translate-x-1'
                      }`}
                    />
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
