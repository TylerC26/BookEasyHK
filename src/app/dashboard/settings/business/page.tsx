'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { ImagePlus, Save, Upload, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { uploadBusinessImage } from '@/lib/business-images';
import { buildBusinessSocialLinks, EMPTY_SOCIAL_LINKS, normalizeOptionalUrl, parseBusinessSocialLinks } from '@/lib/business-profile';
import { useI18n } from '@/lib/i18n/context';
import { AddressMapPicker } from '@/components/address-map-picker';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Business, BusinessSocialLinks, WorkingHours } from '@/lib/types';

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
  const [addressText, setAddressText] = useState('');
  const [addressMapLink, setAddressMapLink] = useState('');
  const [addressLabel, setAddressLabel] = useState('');
  const [businessImageUrl, setBusinessImageUrl] = useState('');
  const [businessImageFile, setBusinessImageFile] = useState<File | null>(null);
  const [socialLinks, setSocialLinks] = useState<BusinessSocialLinks>(EMPTY_SOCIAL_LINKS);
  const [bufferMinutes, setBufferMinutes] = useState(0);
  const [minAdvanceHours, setMinAdvanceHours] = useState(2);
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(30);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

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
    setAddressText(biz.address_text || '');
    setAddressMapLink(biz.address_map_link || '');
    setAddressLabel('');
    setBusinessImageUrl(biz.business_image_url || '');
    setSocialLinks(parseBusinessSocialLinks(biz.social_links));
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
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    if (!business) return;
    setSaving(true);
    setSaved(false);

    try {
      const supabase = createClient();
      let nextBusinessImageUrl = businessImageUrl || null;

      if (businessImageFile) {
        nextBusinessImageUrl = await uploadBusinessImage(supabase, business.owner_id, businessImageFile);
      }

      await supabase
        .from('businesses')
        .update({
          name,
          phone,
          whatsapp: phone,
          address_text: addressText.trim() || null,
          address_map_link: normalizeOptionalUrl(addressMapLink),
          business_image_url: nextBusinessImageUrl,
          social_links: buildBusinessSocialLinks(socialLinks),
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

      setBusinessImageFile(null);
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }

      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      loadData();
    } finally {
      setSaving(false);
    }
  };

  const dayLabels = locale === 'zh-HK' ? DAY_LABELS_ZH : DAY_LABELS_EN;

  const updateHour = (idx: number, field: string, value: string | boolean) => {
    const updated = [...hours];
    (updated[idx] as unknown as Record<string, unknown>)[field] = value;
    setHours(updated);
  };

  const updateSocialLink = (platform: keyof BusinessSocialLinks, value: string) => {
    setSocialLinks((current) => ({
      ...current,
      [platform]: value,
    }));
  };

  const handleBusinessImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setBusinessImageFile(file);
    setBusinessImageUrl(URL.createObjectURL(file));
  };

  const clearBusinessImage = () => {
    setBusinessImageFile(null);
    setBusinessImageUrl('');
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
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
          <Input
            id="biz-address-text"
            label={t('manualAddress')}
            value={addressText}
            onChange={(e) => setAddressText(e.target.value)}
            placeholder={locale === 'zh-HK' ? '例：旺角XX中心12樓1203室' : 'e.g. Unit 1203, 12/F, XX Centre, Mong Kok'}
          />
          <AddressMapPicker
            id="biz-address-link"
            label={t('address')}
            locale={locale}
            value={addressMapLink}
            onChange={setAddressMapLink}
            selectedLabel={addressLabel}
            onSelectedLabelChange={setAddressLabel}
          />
          <Input
            id="biz-slug"
            label={t('bookingSlug')}
            value={business?.slug || ''}
            disabled
            hint={`bookeasyhk.com/${business?.slug}`}
          />
        </div>
        <div className="mt-4 space-y-1.5">
          <p className="block text-xs font-medium text-[#3D3D3D]">{t('businessImage')}</p>
          <input
            ref={imageInputRef}
            id="biz-image"
            type="file"
            accept="image/*"
            onChange={handleBusinessImageChange}
            className="hidden"
          />
          {businessImageUrl ? (
            <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={businessImageUrl} alt={name || 'Business image'} className="h-44 w-full object-cover" />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#D1D5DB] bg-white text-sm text-[#6B7280] transition-colors hover:border-[#0F766E] hover:text-[#0F766E]"
            >
              <ImagePlus size={20} />
              <span>{locale === 'zh-HK' ? '上傳商戶圖片' : 'Upload business image'}</span>
            </button>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => imageInputRef.current?.click()}>
              <Upload size={14} />
              {businessImageUrl
                ? (locale === 'zh-HK' ? '更換圖片' : 'Replace Image')
                : (locale === 'zh-HK' ? '選擇圖片' : 'Choose Image')}
            </Button>
            {businessImageUrl && (
              <Button type="button" variant="ghost" onClick={clearBusinessImage}>
                <X size={14} />
                {locale === 'zh-HK' ? '移除圖片' : 'Remove Image'}
              </Button>
            )}
          </div>
          <p className="text-xs text-[#6B7280]">
            {locale === 'zh-HK' ? '支援 JPG、PNG、WebP，大小不超過 5MB。' : 'Supports JPG, PNG, and WebP up to 5MB.'}
          </p>
        </div>
        <div className="mt-4 rounded-xl border border-[#E5E7EB] p-4">
          <p className="mb-4 text-sm font-medium text-[#111111]">{t('socialMedia')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              id="biz-instagram"
              label={t('instagram')}
              type="url"
              value={socialLinks.instagram || ''}
              onChange={(e) => updateSocialLink('instagram', e.target.value)}
              placeholder="https://instagram.com/yourbusiness"
            />
            <Input
              id="biz-threads"
              label={t('threads')}
              type="url"
              value={socialLinks.threads || ''}
              onChange={(e) => updateSocialLink('threads', e.target.value)}
              placeholder="https://threads.net/@yourbusiness"
            />
            <Input
              id="biz-facebook"
              label={t('facebook')}
              type="url"
              value={socialLinks.facebook || ''}
              onChange={(e) => updateSocialLink('facebook', e.target.value)}
              placeholder="https://facebook.com/yourbusiness"
            />
            <Input
              id="biz-other-link"
              label={t('otherLink')}
              type="url"
              value={socialLinks.other || ''}
              onChange={(e) => updateSocialLink('other', e.target.value)}
              placeholder="https://..."
            />
          </div>
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
