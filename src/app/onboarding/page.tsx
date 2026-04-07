'use client';

import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { AddressMapPicker } from '@/components/address-map-picker';
import { I18nProvider, useI18n } from '@/lib/i18n/context';
import { LanguageToggle } from '@/components/language-toggle';
import { uploadBusinessImage } from '@/lib/business-images';
import { buildBusinessSocialLinks, EMPTY_SOCIAL_LINKS, normalizeOptionalUrl } from '@/lib/business-profile';
import { generateSlug } from '@/lib/utils';
import type { BusinessSocialLinks, BusinessType } from '@/lib/types';
import { Check, ImagePlus, Plus, Trash2, Upload, X } from 'lucide-react';

const DISTRICTS = [
  'Central & Western', 'Wan Chai', 'Eastern', 'Southern',
  'Yau Tsim Mong', 'Sham Shui Po', 'Kowloon City', 'Wong Tai Sin',
  'Kwun Tong', 'Tsuen Wan', 'Tuen Mun', 'Yuen Long',
  'North', 'Tai Po', 'Sha Tin', 'Sai Kung',
  'Kwai Tsing', 'Islands',
];

const DEFAULT_HOURS = Array.from({ length: 7 }, (_, i) => ({
  day_of_week: i,
  is_open: i !== 0,
  open_time: '10:00',
  close_time: '20:00',
  break_start: '13:00',
  break_end: '14:00',
}));

const DAY_LABELS_ZH = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const DAY_LABELS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface ServiceDraft {
  name: string;
  name_zh: string;
  duration_minutes: number;
  price_hkd: number;
}

function OnboardingWizard() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState<BusinessType>('nail');
  const [district, setDistrict] = useState('Yau Tsim Mong');
  const [addressText, setAddressText] = useState('');
  const [addressMapLink, setAddressMapLink] = useState('');
  const [addressLabel, setAddressLabel] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [businessImageFile, setBusinessImageFile] = useState<File | null>(null);
  const [businessImagePreviewUrl, setBusinessImagePreviewUrl] = useState('');
  const [socialLinks, setSocialLinks] = useState<BusinessSocialLinks>(EMPTY_SOCIAL_LINKS);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  // Step 2
  const [services, setServices] = useState<ServiceDraft[]>([
    { name: '', name_zh: '', duration_minutes: 60, price_hkd: 0 },
  ]);

  // Step 3
  const [hours, setHours] = useState(DEFAULT_HOURS);

  // Step 4
  const [slug, setSlug] = useState('');

  const dayLabels = locale === 'zh-HK' ? DAY_LABELS_ZH : DAY_LABELS_EN;

  const businessTypeOptions = [
    { value: 'nail', label: t('typeNail') },
    { value: 'hair', label: t('typeHair') },
    { value: 'carwash', label: t('typeCarwash') },
    { value: 'pet', label: t('typePet') },
    { value: 'massage', label: t('typeMassage') },
    { value: 'beauty', label: t('typeBeauty') },
    { value: 'other', label: t('typeOther') },
  ];

  const districtOptions = DISTRICTS.map((d) => ({ value: d, label: d }));

  const handleNext = () => {
    if (step === 1 && !businessName.trim()) return;
    if (step === 2 && services.every((s) => !s.name.trim())) return;
    if (step === 1 && !slug) setSlug(generateSlug(businessName));
    setStep((s) => Math.min(s + 1, 5));
  };

  const handleBack = () => setStep((s) => Math.max(s - 1, 1));

  const addService = () => {
    setServices([...services, { name: '', name_zh: '', duration_minutes: 60, price_hkd: 0 }]);
  };

  const removeService = (idx: number) => {
    if (services.length <= 1) return;
    setServices(services.filter((_, i) => i !== idx));
  };

  const updateService = (idx: number, field: keyof ServiceDraft, value: string | number) => {
    const updated = [...services];
    (updated[idx] as unknown as Record<string, string | number>)[field] = value;
    setServices(updated);
  };

  const updateHour = (idx: number, field: string, value: string | boolean) => {
    const updated = [...hours];
    (updated[idx] as unknown as Record<string, string | boolean>)[field] = value;
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
    setBusinessImagePreviewUrl(URL.createObjectURL(file));
    setError('');
  };

  const clearBusinessImage = () => {
    setBusinessImageFile(null);
    setBusinessImagePreviewUrl('');
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    setError('');

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let businessImageUrl: string | null = null;
      if (businessImageFile) {
        businessImageUrl = await uploadBusinessImage(supabase, user.id, businessImageFile);
      }

      const { data: business, error: bizError } = await supabase
        .from('businesses')
        .insert({
          owner_id: user.id,
          name: businessName,
          type: businessType,
          district,
          address_text: addressText.trim() || null,
          address_map_link: normalizeOptionalUrl(addressMapLink),
          phone,
          whatsapp: whatsapp || phone,
          slug: slug || generateSlug(businessName),
          business_image_url: businessImageUrl,
          social_links: buildBusinessSocialLinks(socialLinks),
          onboarding_complete: true,
          language: locale,
        })
        .select()
        .single();

      if (bizError) throw bizError;

      const validServices = services.filter((s) => s.name.trim());
      if (validServices.length > 0) {
        const { error: svcError } = await supabase.from('services').insert(
          validServices.map((s, i) => ({
            business_id: business.id,
            name: s.name,
            name_zh: s.name_zh || null,
            duration_minutes: s.duration_minutes,
            price_hkd: s.price_hkd || null,
            sort_order: i,
          }))
        );
        if (svcError) throw svcError;
      }

      const { error: hoursError } = await supabase.from('working_hours').insert(
        hours.map((h) => ({
          business_id: business.id,
          day_of_week: h.day_of_week,
          is_open: h.is_open,
          open_time: h.is_open ? h.open_time : null,
          close_time: h.is_open ? h.close_time : null,
          break_start: h.is_open ? h.break_start : null,
          break_end: h.is_open ? h.break_end : null,
        }))
      );
      if (hoursError) throw hoursError;

      setStep(5);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <span className="font-display text-2xl font-light text-[#111111]">
            BookEasy<span className="text-[#0F766E]">.</span>
          </span>
          <LanguageToggle />
        </div>

        <h2 className="text-2xl font-bold mb-2">{t('onboardingTitle')}</h2>

        {/* Progress bar */}
        <div className="flex gap-2 mb-8">
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                s <= step ? 'bg-primary' : 'bg-border'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Business Info */}
        {step === 1 && (
          <Card>
            <h3 className="text-lg font-semibold mb-4">{t('step1Title')}</h3>
            <div className="space-y-4">
              <Input
                id="businessName"
                label={t('businessName')}
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder={locale === 'zh-HK' ? '例：美美美甲' : 'e.g. Mei Mei Nails'}
                required
              />
              <Select
                id="businessType"
                label={t('businessType')}
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value as BusinessType)}
                options={businessTypeOptions}
              />
              <Select
                id="district"
                label={t('district')}
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                options={districtOptions}
              />
              <Input
                id="addressText"
                label={t('manualAddress')}
                value={addressText}
                onChange={(e) => setAddressText(e.target.value)}
                placeholder={locale === 'zh-HK' ? '例：旺角XX中心12樓1203室' : 'e.g. Unit 1203, 12/F, XX Centre, Mong Kok'}
                hint={locale === 'zh-HK' ? '可加入房號、樓層、大廈名稱等資料' : 'Include room number, floor, building name, etc.'}
              />
              <AddressMapPicker
                id="addressMapLink"
                label={t('address')}
                locale={locale}
                value={addressMapLink}
                onChange={setAddressMapLink}
                selectedLabel={addressLabel}
                onSelectedLabelChange={setAddressLabel}
              />
              <Input
                id="phone"
                label={t('phone')}
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+852 9XXX XXXX"
              />
              <Input
                id="whatsapp"
                label={t('whatsappNumber')}
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="+852 9XXX XXXX"
                hint={locale === 'zh-HK' ? '如與電話號碼相同可留空' : 'Leave blank if same as phone'}
              />
              <div className="space-y-1.5">
                <p className="block text-xs font-medium text-[#3D3D3D]">{t('businessImage')}</p>
                <input
                  ref={imageInputRef}
                  id="businessImage"
                  type="file"
                  accept="image/*"
                  onChange={handleBusinessImageChange}
                  className="hidden"
                />
                {businessImagePreviewUrl ? (
                  <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={businessImagePreviewUrl}
                      alt={businessName || 'Business preview'}
                      className="h-40 w-full object-cover"
                    />
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
                    {businessImagePreviewUrl
                      ? (locale === 'zh-HK' ? '更換圖片' : 'Replace Image')
                      : (locale === 'zh-HK' ? '選擇圖片' : 'Choose Image')}
                  </Button>
                  {businessImagePreviewUrl && (
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
              <div className="rounded-xl border border-[#E5E7EB] p-4 space-y-4">
                <p className="text-sm font-medium text-[#111111]">{t('socialMedia')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    id="instagram"
                    label={t('instagram')}
                    type="url"
                    value={socialLinks.instagram || ''}
                    onChange={(e) => updateSocialLink('instagram', e.target.value)}
                    placeholder="https://instagram.com/yourbusiness"
                  />
                  <Input
                    id="threads"
                    label={t('threads')}
                    type="url"
                    value={socialLinks.threads || ''}
                    onChange={(e) => updateSocialLink('threads', e.target.value)}
                    placeholder="https://threads.net/@yourbusiness"
                  />
                  <Input
                    id="facebook"
                    label={t('facebook')}
                    type="url"
                    value={socialLinks.facebook || ''}
                    onChange={(e) => updateSocialLink('facebook', e.target.value)}
                    placeholder="https://facebook.com/yourbusiness"
                  />
                  <Input
                    id="otherLink"
                    label={t('otherLink')}
                    type="url"
                    value={socialLinks.other || ''}
                    onChange={(e) => updateSocialLink('other', e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={handleNext} disabled={!businessName.trim()}>
                {t('next')}
              </Button>
            </div>
          </Card>
        )}

        {/* Step 2: Services */}
        {step === 2 && (
          <Card>
            <h3 className="text-lg font-semibold mb-4">{t('step2Title')}</h3>
            <div className="space-y-4">
              {services.map((svc, idx) => (
                <div key={idx} className="p-4 bg-slate-50 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted">
                      {locale === 'zh-HK' ? `服務 ${idx + 1}` : `Service ${idx + 1}`}
                    </span>
                    {services.length > 1 && (
                      <button
                        onClick={() => removeService(idx)}
                        className="text-danger hover:text-red-700 cursor-pointer"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      id={`svc-name-${idx}`}
                      label={t('serviceName')}
                      value={svc.name}
                      onChange={(e) => updateService(idx, 'name', e.target.value)}
                      placeholder={locale === 'zh-HK' ? '例：gel 甲' : 'e.g. Gel Nails'}
                    />
                    <Input
                      id={`svc-name-zh-${idx}`}
                      label={t('serviceNameZh')}
                      value={svc.name_zh}
                      onChange={(e) => updateService(idx, 'name_zh', e.target.value)}
                      placeholder="例：gel 甲"
                    />
                    <Input
                      id={`svc-duration-${idx}`}
                      label={t('duration')}
                      type="number"
                      min={15}
                      step={15}
                      value={svc.duration_minutes}
                      onChange={(e) => updateService(idx, 'duration_minutes', parseInt(e.target.value) || 0)}
                    />
                    <Input
                      id={`svc-price-${idx}`}
                      label={t('price')}
                      type="number"
                      min={0}
                      value={svc.price_hkd}
                      onChange={(e) => updateService(idx, 'price_hkd', parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>
              ))}
              <Button variant="outline" onClick={addService} className="w-full">
                <Plus size={16} /> {t('addService')}
              </Button>
            </div>
            <div className="mt-6 flex justify-between">
              <Button variant="ghost" onClick={handleBack}>{t('back')}</Button>
              <Button onClick={handleNext} disabled={services.every((s) => !s.name.trim())}>
                {t('next')}
              </Button>
            </div>
          </Card>
        )}

        {/* Step 3: Working Hours */}
        {step === 3 && (
          <Card>
            <h3 className="text-lg font-semibold mb-4">{t('step3Title')}</h3>
            <div className="space-y-3">
              {hours.map((h, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="w-16 text-sm font-medium">{dayLabels[h.day_of_week]}</div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={h.is_open}
                      onChange={(e) => updateHour(idx, 'is_open', e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-xs text-muted">
                      {h.is_open ? '' : t('dayOff')}
                    </span>
                  </label>
                  {h.is_open && (
                    <div className="flex items-center gap-2 flex-1 flex-wrap">
                      <input
                        type="time"
                        value={h.open_time}
                        onChange={(e) => updateHour(idx, 'open_time', e.target.value)}
                        className="h-8 px-2 text-xs border border-border rounded-lg bg-white"
                      />
                      <span className="text-xs text-muted">–</span>
                      <input
                        type="time"
                        value={h.close_time}
                        onChange={(e) => updateHour(idx, 'close_time', e.target.value)}
                        className="h-8 px-2 text-xs border border-border rounded-lg bg-white"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-between">
              <Button variant="ghost" onClick={handleBack}>{t('back')}</Button>
              <Button onClick={handleNext}>{t('next')}</Button>
            </div>
          </Card>
        )}

        {/* Step 4: Slug */}
        {step === 4 && (
          <Card>
            <h3 className="text-lg font-semibold mb-4">{t('step4Title')}</h3>
            <div className="space-y-4">
              <Input
                id="slug"
                label={t('bookingSlug')}
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
              />
              <div className="p-3 bg-primary-light rounded-xl">
                <p className="text-sm text-muted">{t('slugPreview')}</p>
                <p className="text-sm font-mono font-medium text-primary mt-1">
                  bookeasyhk.com/{slug || '...'}
                </p>
              </div>
            </div>
            {error && (
              <p className="text-sm text-danger bg-red-50 p-3 rounded-lg mt-4">{error}</p>
            )}
            <div className="mt-6 flex justify-between">
              <Button variant="ghost" onClick={handleBack}>{t('back')}</Button>
              <Button onClick={handleComplete} loading={loading}>
                {t('completeSetup')}
              </Button>
            </div>
          </Card>
        )}

        {/* Step 5: Done */}
        {step === 5 && (
          <Card className="text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="text-emerald-600" size={32} />
            </div>
            <h3 className="text-xl font-bold mb-2">{t('setupComplete')}</h3>
            <p className="text-muted mb-6">
              {locale === 'zh-HK'
                ? '你的預約頁面已上線，客人現在可以開始預約了！'
                : 'Your booking page is live. Customers can now start booking!'}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={() => router.push('/dashboard')}>
                {t('dashboard')}
              </Button>
              <Button
                variant="outline"
                onClick={() => window.open(`/book/${slug}`, '_blank')}
              >
                {t('bookingPage')}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <I18nProvider>
      <OnboardingWizard />
    </I18nProvider>
  );
}
