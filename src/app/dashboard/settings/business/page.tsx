'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  ImagePlus, Save, Upload, X, Copy, Check, ExternalLink,
  Building2, Phone as PhoneIcon, MessageCircle, MapPin,
  Globe, Link as LinkIcon,
  Image as ImageIcon, Plus, Minus,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { uploadBusinessImage } from '@/lib/business-images';
import {
  buildBusinessSocialLinks, EMPTY_SOCIAL_LINKS,
  normalizeOptionalUrl, parseBusinessSocialLinks,
} from '@/lib/business-profile';
import { useI18n } from '@/lib/i18n/context';
import { AddressMapPicker } from '@/components/address-map-picker';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { getBusinessTypeEmoji } from '@/lib/utils';
import type { Business, BusinessSocialLinks, BusinessType, WorkingHours } from '@/lib/types';

const DAY_LABELS_ZH = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const DAY_SHORT_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const HK_DISTRICTS = [
  'Central & Western', 'Wan Chai', 'Eastern', 'Southern',
  'Yau Tsim Mong', 'Sham Shui Po', 'Kowloon City', 'Wong Tai Sin',
  'Kwun Tong', 'Tsuen Wan', 'Tuen Mun', 'Yuen Long',
  'North', 'Tai Po', 'Sha Tin', 'Sai Kung',
  'Kwai Tsing', 'Islands',
];

const TYPE_OPTIONS: BusinessType[] = ['nail', 'hair', 'carwash', 'pet', 'massage', 'beauty', 'other'];

function typeLabel(type: BusinessType, zh: boolean) {
  const map: Record<BusinessType, [string, string]> = {
    nail: ['美甲', 'Nail'],
    hair: ['髮型', 'Hair'],
    carwash: ['洗車', 'Carwash'],
    pet: ['寵物', 'Pet'],
    massage: ['按摩', 'Massage'],
    beauty: ['美容', 'Beauty'],
    other: ['其他', 'Other'],
  };
  return zh ? map[type][0] : map[type][1];
}

export default function BusinessSettingsPage() {
  const { t, locale } = useI18n();
  const zh = locale === 'zh-HK';
  const [business, setBusiness] = useState<Business | null>(null);
  const [hours, setHours] = useState<WorkingHours[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [slugCopied, setSlugCopied] = useState(false);

  const [name, setName] = useState('');
  const [type, setType] = useState<BusinessType>('other');
  const [district, setDistrict] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [whatsappLinked, setWhatsappLinked] = useState(true);
  const [addressText, setAddressText] = useState('');
  const [addressMapLink, setAddressMapLink] = useState('');
  const [addressLabel, setAddressLabel] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [businessImageUrl, setBusinessImageUrl] = useState('');
  const [businessImageFile, setBusinessImageFile] = useState<File | null>(null);
  const [socialLinks, setSocialLinks] = useState<BusinessSocialLinks>(EMPTY_SOCIAL_LINKS);
  const [bufferMinutes, setBufferMinutes] = useState(0);
  const [minAdvanceHours, setMinAdvanceHours] = useState(2);
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(30);

  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

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
    setName(biz.name);
    setType(biz.type || 'other');
    setDistrict(biz.district || '');
    setPhone(biz.phone || '');
    setWhatsapp(biz.whatsapp || biz.phone || '');
    setWhatsappLinked((biz.whatsapp || biz.phone || '') === (biz.phone || ''));
    setAddressText(biz.address_text || '');
    setAddressMapLink(biz.address_map_link || '');
    setAddressLabel('');
    setLogoUrl(biz.logo_url || '');
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
    const run = async () => {
      await loadData();
    };
    void run();
  }, [loadData]);

  const handleSave = async () => {
    if (!business) return;
    setSaving(true);
    setSaved(false);

    try {
      const supabase = createClient();
      let nextLogoUrl = logoUrl || null;
      let nextBusinessImageUrl = businessImageUrl || null;

      if (logoFile) {
        nextLogoUrl = await uploadBusinessImage(supabase, business.owner_id, logoFile);
      }
      if (businessImageFile) {
        nextBusinessImageUrl = await uploadBusinessImage(supabase, business.owner_id, businessImageFile);
      }

      await supabase
        .from('businesses')
        .update({
          name,
          type,
          district: district || null,
          phone,
          whatsapp: whatsappLinked ? phone : whatsapp,
          address_text: addressText.trim() || null,
          address_map_link: normalizeOptionalUrl(addressMapLink),
          logo_url: nextLogoUrl,
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

      setLogoFile(null);
      setBusinessImageFile(null);
      if (logoInputRef.current) logoInputRef.current.value = '';
      if (imageInputRef.current) imageInputRef.current.value = '';

      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2400);
      loadData();
    } finally {
      setSaving(false);
    }
  };

  const dayShort = zh ? DAY_LABELS_ZH : DAY_SHORT_EN;

  const updateHour = (idx: number, field: keyof WorkingHours, value: string | boolean | null) => {
    const updated = [...hours];
    (updated[idx] as unknown as Record<string, unknown>)[field as string] = value;
    setHours(updated);
  };

  const copyMondayToWeekdays = () => {
    const monday = hours.find((h) => h.day_of_week === 1);
    if (!monday) return;
    const updated = hours.map((h) =>
      h.day_of_week >= 1 && h.day_of_week <= 5
        ? { ...h, is_open: monday.is_open, open_time: monday.open_time, close_time: monday.close_time, break_start: monday.break_start, break_end: monday.break_end }
        : h
    );
    setHours(updated);
  };

  const updateSocialLink = (platform: keyof BusinessSocialLinks, value: string) => {
    setSocialLinks((current) => ({ ...current, [platform]: value }));
  };

  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoUrl(URL.createObjectURL(file));
  };

  const handleBusinessImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusinessImageFile(file);
    setBusinessImageUrl(URL.createObjectURL(file));
  };

  const clearLogo = () => {
    setLogoFile(null);
    setLogoUrl('');
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const clearBusinessImage = () => {
    setBusinessImageFile(null);
    setBusinessImageUrl('');
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const copySlug = async () => {
    const url = `bookeasyhk.com/${business?.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setSlugCopied(true);
      setTimeout(() => setSlugCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  // ── Completion meter ────────────────────────────────────────────────────────
  const completion = useMemo(() => {
    const fields = [
      !!name,
      !!type,
      !!district,
      !!phone,
      !!(addressText || addressMapLink),
      !!businessImageUrl,
      !!logoUrl,
      !!(socialLinks.instagram || socialLinks.threads || socialLinks.facebook || socialLinks.other),
      hours.some((h) => h.is_open),
    ];
    const filled = fields.filter(Boolean).length;
    return { filled, total: fields.length };
  }, [name, type, district, phone, addressText, addressMapLink, businessImageUrl, logoUrl, socialLinks, hours]);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted">{t('loading')}</div>;
  }

  return (
    <div className="space-y-7 pb-24">
      {/* ── HEADER ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between animate-fade-up">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#9CA3AF] mb-1">
            {zh ? '設定 · 商戶資料' : 'Settings · Business profile'}
          </p>
          <h1 className="font-display text-[28px] md:text-[34px] leading-[1.05] font-light text-[#111111]">
            {zh ? '商戶資料' : 'Your business'}<span className="text-[#0F766E]">.</span>
          </h1>
          <p className="text-sm text-[#6B7280] mt-1.5 max-w-xl">
            {zh
              ? '客人會在預約頁面看到這些資料，請保持最新。'
              : 'Customers see this on your booking page — keep it current and on-brand.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <CompletionMeter filled={completion.filled} total={completion.total} zh={zh} />
          <a
            href={`/book/${business?.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-[#E5E7EB] text-[#6B7280] hover:border-[#0F766E] hover:text-[#0F766E] transition-colors"
          >
            <ExternalLink size={13} />
            {zh ? '預覽' : 'Preview'}
          </a>
        </div>
      </div>

      {/* ── SLUG PILL ──────────────────────────────────────────── */}
      <div className="animate-fade-up" style={{ animationDelay: '40ms' }}>
        <button
          onClick={copySlug}
          className="group inline-flex items-center gap-3 rounded-full border border-[#E5E7EB] bg-white pl-4 pr-2 py-1.5 hover:border-[#0F766E]/50 transition-colors cursor-pointer max-w-full"
        >
          <span className="text-[10px] uppercase tracking-[0.18em] text-[#9CA3AF]">URL</span>
          <span className="text-[#9CA3AF] truncate">bookeasyhk.com/<span className="text-[#0F766E] font-medium">{business?.slug}</span></span>
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#F3F4F6] group-hover:bg-[#0F766E]/10 text-[#6B7280] group-hover:text-[#0F766E] transition-colors shrink-0">
            {slugCopied ? <Check size={13} /> : <Copy size={13} />}
          </span>
        </button>
      </div>

      {/* ── IDENTITY ───────────────────────────────────────────── */}
      <Section
        eyebrow={zh ? '01 · 身份' : '01 · Identity'}
        title={zh ? '品牌與身份' : 'Brand & identity'}
        hint={zh ? '客人首先看到的是你的店名、類型與所在地區。' : 'The first things customers register about you.'}
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7 space-y-4">
            <Input
              id="biz-name"
              label={t('businessName')}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                id="biz-type"
                label={zh ? '商戶類型' : 'Business type'}
                value={type}
                onChange={(e) => setType(e.target.value as BusinessType)}
                options={TYPE_OPTIONS.map((tp) => ({
                  value: tp,
                  label: `${getBusinessTypeEmoji(tp)}  ${typeLabel(tp, zh)}`,
                }))}
              />
              <Select
                id="biz-district"
                label={zh ? '地區' : 'District'}
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                options={[
                  { value: '', label: zh ? '選擇地區' : 'Select district' },
                  ...HK_DISTRICTS.map((d) => ({ value: d, label: d })),
                ]}
              />
            </div>
          </div>

          {/* Live preview card */}
          <div className="lg:col-span-5">
            <div className="h-full rounded-2xl border border-[#E5E7EB] bg-gradient-to-br from-[#FAFAF8] to-white p-5 flex flex-col items-center justify-center text-center min-h-[180px] relative overflow-hidden">
              <DotPattern />
              <div className="relative">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF] mb-2">
                  {zh ? '客戶看到的樣子' : 'How customers see you'}
                </p>
                <div className="flex items-center justify-center gap-2 mb-2">
                  {logoUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={logoUrl} alt="logo" className="w-9 h-9 rounded-full border border-[#E5E7EB] object-cover" />
                  )}
                  <h3 className="font-display text-2xl font-light text-[#111111] truncate max-w-full">
                    {name || (zh ? '未命名' : 'Unnamed')}<span className="text-[#0F766E]">.</span>
                  </h3>
                </div>
                <p className="text-xs text-[#6B7280] truncate">
                  <span className="mr-1">{getBusinessTypeEmoji(type)}</span>
                  {typeLabel(type, zh)}
                  {district && <span className="text-[#9CA3AF]"> · {district}</span>}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── VISUAL ─────────────────────────────────────────────── */}
      <Section
        eyebrow={zh ? '02 · 視覺' : '02 · Visual'}
        title={zh ? '商標與封面' : 'Logo & cover'}
        hint={zh ? '上載一張清晰的封面與標誌圖。' : 'Crisp visuals make your booking page feel premium.'}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Logo */}
          <div className="md:col-span-1 space-y-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF]">
              {zh ? '標誌' : 'Logo'}
            </p>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoChange}
              className="hidden"
            />
            {logoUrl ? (
              <div className="aspect-square rounded-2xl border border-[#E5E7EB] bg-white overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt="logo" className="w-full h-full object-cover" />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                className="aspect-square w-full rounded-2xl border border-dashed border-[#D1D5DB] bg-white flex flex-col items-center justify-center gap-2 text-sm text-[#6B7280] hover:border-[#0F766E] hover:text-[#0F766E] transition-colors"
              >
                <Building2 size={22} />
                <span>{zh ? '加入標誌' : 'Add logo'}</span>
              </button>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => logoInputRef.current?.click()}>
                <Upload size={12} />
                {logoUrl ? (zh ? '更換' : 'Replace') : (zh ? '選擇' : 'Choose')}
              </Button>
              {logoUrl && (
                <Button type="button" variant="ghost" size="sm" onClick={clearLogo}>
                  <X size={12} /> {zh ? '移除' : 'Remove'}
                </Button>
              )}
            </div>
          </div>

          {/* Cover */}
          <div className="md:col-span-2 space-y-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF]">
              {zh ? '封面圖片' : 'Cover image'}
            </p>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={handleBusinessImageChange}
              className="hidden"
            />
            {businessImageUrl ? (
              <div className="rounded-2xl border border-[#E5E7EB] bg-white overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={businessImageUrl} alt={name || 'Cover'} className="h-48 w-full object-cover" />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="h-48 w-full rounded-2xl border border-dashed border-[#D1D5DB] bg-white flex flex-col items-center justify-center gap-2 text-sm text-[#6B7280] hover:border-[#0F766E] hover:text-[#0F766E] transition-colors"
              >
                <ImagePlus size={22} />
                <span>{zh ? '上傳封面圖片' : 'Upload cover image'}</span>
              </button>
            )}
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => imageInputRef.current?.click()}>
                <Upload size={12} />
                {businessImageUrl ? (zh ? '更換圖片' : 'Replace image') : (zh ? '選擇圖片' : 'Choose image')}
              </Button>
              {businessImageUrl && (
                <Button type="button" variant="ghost" size="sm" onClick={clearBusinessImage}>
                  <X size={12} /> {zh ? '移除' : 'Remove'}
                </Button>
              )}
              <span className="text-[11px] text-[#9CA3AF] ml-auto">
                <ImageIcon size={11} className="inline mr-1" />
                {zh ? 'JPG / PNG / WebP · 最大 5MB' : 'JPG / PNG / WebP · max 5MB'}
              </span>
            </div>
          </div>
        </div>
      </Section>

      {/* ── CONTACT ────────────────────────────────────────────── */}
      <Section
        eyebrow={zh ? '03 · 聯絡' : '03 · Contact'}
        title={zh ? '聯絡與位置' : 'Contact & location'}
        hint={zh ? '客人會用這些資料聯繫你及尋找你的店。' : 'How and where customers reach you.'}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            id="biz-phone"
            label={
              <span className="inline-flex items-center gap-1.5">
                <PhoneIcon size={12} className="text-[#9CA3AF]" /> {t('phone')}
              </span> as unknown as string
            }
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              if (whatsappLinked) setWhatsapp(e.target.value);
            }}
          />
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="biz-whatsapp" className="text-sm font-medium text-[#3D3D3D] inline-flex items-center gap-1.5">
                <MessageCircle size={12} className="text-[#9CA3AF]" /> WhatsApp
              </label>
              <button
                type="button"
                onClick={() => {
                  const next = !whatsappLinked;
                  setWhatsappLinked(next);
                  if (next) setWhatsapp(phone);
                }}
                className="text-[10px] uppercase tracking-[0.18em] text-[#0F766E] hover:underline cursor-pointer"
              >
                {whatsappLinked ? (zh ? '解除連動' : 'Unlink') : (zh ? '與電話相同' : 'Same as phone')}
              </button>
            </div>
            <input
              id="biz-whatsapp"
              type="tel"
              value={whatsapp}
              disabled={whatsappLinked}
              onChange={(e) => setWhatsapp(e.target.value)}
              className={`w-full h-10 px-3.5 rounded-lg border text-sm transition-colors ${
                whatsappLinked
                  ? 'bg-[#F9FAFB] border-[#E5E7EB] text-[#9CA3AF]'
                  : 'bg-white border-[#E5E7EB] text-[#111111] focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]'
              }`}
            />
          </div>

          <Input
            id="biz-address-text"
            label={
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={12} className="text-[#9CA3AF]" /> {t('manualAddress')}
              </span> as unknown as string
            }
            value={addressText}
            onChange={(e) => setAddressText(e.target.value)}
            placeholder={zh ? '例：旺角XX中心12樓1203室' : 'e.g. Unit 1203, 12/F, XX Centre, Mong Kok'}
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
        </div>
      </Section>

      {/* ── SOCIAL ─────────────────────────────────────────────── */}
      <Section
        eyebrow={zh ? '04 · 社交' : '04 · Social'}
        title={zh ? '社交媒體' : 'Social presence'}
        hint={zh ? '展示你的作品與評價，建立信任。' : 'Show your work, build trust.'}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SocialField
            id="biz-instagram"
            icon={<span className="font-display text-[12px] leading-none font-light">IG</span>}
            label="Instagram"
            value={socialLinks.instagram || ''}
            onChange={(v) => updateSocialLink('instagram', v)}
            placeholder="https://instagram.com/yourbusiness"
          />
          <SocialField
            id="biz-threads"
            icon={<span className="font-display text-[14px] leading-none">@</span>}
            label="Threads"
            value={socialLinks.threads || ''}
            onChange={(v) => updateSocialLink('threads', v)}
            placeholder="https://threads.net/@yourbusiness"
          />
          <SocialField
            id="biz-facebook"
            icon={<span className="font-display text-[13px] leading-none font-medium">f</span>}
            label="Facebook"
            value={socialLinks.facebook || ''}
            onChange={(v) => updateSocialLink('facebook', v)}
            placeholder="https://facebook.com/yourbusiness"
          />
          <SocialField
            id="biz-other"
            icon={<Globe size={13} />}
            label={zh ? '其他連結' : 'Website / other'}
            value={socialLinks.other || ''}
            onChange={(v) => updateSocialLink('other', v)}
            placeholder="https://..."
          />
        </div>
      </Section>

      {/* ── BOOKING RULES ──────────────────────────────────────── */}
      <Section
        eyebrow={zh ? '05 · 預約規則' : '05 · Booking rules'}
        title={zh ? '預約規則' : 'How customers can book'}
        hint={zh ? '控制預約間隔、提前時間及最遠日期。' : 'Tune buffers, lead time, and how far ahead bookings open.'}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <NumberStepper
            label={zh ? '預約間隔' : 'Buffer between bookings'}
            unit={zh ? '分鐘' : 'min'}
            value={bufferMinutes}
            onChange={setBufferMinutes}
            min={0}
            step={5}
            hint={zh ? '兩個預約之間留出的清潔／緩衝時間' : 'Cleanup or breathing room between bookings'}
          />
          <NumberStepper
            label={zh ? '最少提前' : 'Min advance notice'}
            unit={zh ? '小時' : 'hr'}
            value={minAdvanceHours}
            onChange={setMinAdvanceHours}
            min={0}
            step={1}
            hint={zh ? '客人要提前多少小時才能預約' : 'How early customers must book'}
          />
          <NumberStepper
            label={zh ? '最遠預約' : 'Max advance window'}
            unit={zh ? '日' : 'd'}
            value={maxAdvanceDays}
            onChange={setMaxAdvanceDays}
            min={1}
            step={1}
            hint={zh ? '客人最多可以預多遠' : 'How far ahead the calendar opens'}
          />
        </div>
      </Section>

      {/* ── WORKING HOURS ──────────────────────────────────────── */}
      <Section
        eyebrow={zh ? '06 · 營業時間' : '06 · Hours'}
        title={t('workingHours')}
        hint={zh ? '勾選每日是否營業並設定時間。' : 'Toggle each day and set open / close.'}
        action={
          <button
            type="button"
            onClick={copyMondayToWeekdays}
            className="text-[11px] uppercase tracking-[0.18em] text-[#0F766E] hover:underline cursor-pointer inline-flex items-center gap-1"
          >
            <Copy size={11} />
            {zh ? '套用至平日' : 'Apply Mon to weekdays'}
          </button>
        }
      >
        <div className="space-y-1">
          {hours.map((h, idx) => {
            const hasBreak = !!(h.break_start && h.break_end);
            return (
              <div
                key={h.id}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  h.is_open ? 'hover:bg-[#FAFAF8]' : 'opacity-60 hover:opacity-100 hover:bg-[#FAFAF8]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => updateHour(idx, 'is_open', !h.is_open)}
                  className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${
                    h.is_open ? 'bg-[#0F766E]' : 'bg-[#E5E7EB]'
                  }`}
                  aria-pressed={h.is_open}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${
                      h.is_open ? 'left-[18px]' : 'left-0.5'
                    }`}
                  />
                </button>
                <div className="w-24 shrink-0">
                  <div className="font-display text-[15px] font-light text-[#111111] leading-none">
                    {dayShort[h.day_of_week]}
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-[#9CA3AF] mt-0.5">
                    {h.day_of_week === 0 || h.day_of_week === 6
                      ? (zh ? '週末' : 'Weekend')
                      : (zh ? '平日' : 'Weekday')}
                  </div>
                </div>

                {h.is_open ? (
                  <div className="flex-1 flex items-center gap-2 flex-wrap">
                    <TimeSlotInput
                      value={h.open_time || '10:00'}
                      onChange={(v) => updateHour(idx, 'open_time', v)}
                    />
                    <span className="text-[#9CA3AF] text-xs">→</span>
                    <TimeSlotInput
                      value={h.close_time || '20:00'}
                      onChange={(v) => updateHour(idx, 'close_time', v)}
                    />

                    {hasBreak ? (
                      <div className="inline-flex items-center gap-1.5 ml-1.5 px-2.5 py-1 rounded-full bg-[#FAFAF8] border border-[#E5E7EB]">
                        <span className="text-[10px] uppercase tracking-wider text-[#9CA3AF]">
                          {zh ? '休息' : 'Break'}
                        </span>
                        <TimeSlotInput
                          compact
                          value={h.break_start || '13:00'}
                          onChange={(v) => updateHour(idx, 'break_start', v)}
                        />
                        <span className="text-[#9CA3AF] text-[10px]">→</span>
                        <TimeSlotInput
                          compact
                          value={h.break_end || '14:00'}
                          onChange={(v) => updateHour(idx, 'break_end', v)}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            updateHour(idx, 'break_start', null);
                            updateHour(idx, 'break_end', null);
                          }}
                          className="text-[#9CA3AF] hover:text-red-500 ml-0.5"
                          aria-label="remove break"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          updateHour(idx, 'break_start', '13:00');
                          updateHour(idx, 'break_end', '14:00');
                        }}
                        className="ml-1.5 text-[10px] uppercase tracking-[0.18em] text-[#9CA3AF] hover:text-[#0F766E] inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={10} /> {zh ? '加入休息時間' : 'Add break'}
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="flex-1 text-xs text-[#9CA3AF] italic">
                    {t('dayOff')}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      {/* ── STICKY SAVE BAR ────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 lg:left-56 right-0 bg-white/95 backdrop-blur border-t border-[#E5E7EB] z-40">
        <div className="px-5 lg:px-8 py-3 flex items-center justify-between gap-3">
          <p className="text-xs text-[#9CA3AF] hidden sm:block">
            {saved
              ? (zh ? '已儲存' : 'Saved · live on your booking page')
              : (zh ? '記得儲存你的更改。' : 'Remember to save your changes.')}
          </p>
          <div className="flex items-center gap-2 ml-auto">
            <Button onClick={handleSave} loading={saving}>
              {saved ? <Check size={16} /> : <Save size={16} />}
              {saved ? (zh ? '已儲存' : 'Saved') : t('save')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── COMPLETION METER ─────────────────────────────────────────────────────────

function CompletionMeter({ filled, total, zh }: { filled: number; total: number; zh: boolean }) {
  const pct = Math.round((filled / total) * 100);
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (filled / total) * circumference;

  return (
    <div className="hidden sm:flex items-center gap-2.5 rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5">
      <svg width="36" height="36" viewBox="0 0 36 36" className="-rotate-90">
        <circle cx="18" cy="18" r={radius} fill="none" stroke="#F3F4F6" strokeWidth="2.5" />
        <circle
          cx="18" cy="18" r={radius}
          fill="none"
          stroke="#0F766E"
          strokeWidth="2.5"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div className="text-left leading-tight">
        <div className="font-display text-[15px] font-light tabular-nums text-[#111111]">
          {pct}<span className="text-[10px] text-[#9CA3AF]">%</span>
        </div>
        <div className="text-[9px] uppercase tracking-[0.18em] text-[#9CA3AF]">
          {zh ? '完成度' : 'Complete'}
        </div>
      </div>
    </div>
  );
}

// ── SECTION ──────────────────────────────────────────────────────────────────

function Section({
  eyebrow,
  title,
  hint,
  action,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-6 animate-fade-up">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF] font-medium mb-1">{eyebrow}</p>
          <h2 className="font-display text-[20px] font-light text-[#111111] leading-tight">{title}</h2>
          {hint && <p className="text-xs text-[#6B7280] mt-1.5 max-w-xl">{hint}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </Card>
  );
}

// ── DOT PATTERN ──────────────────────────────────────────────────────────────

function DotPattern() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 opacity-[0.4] pointer-events-none"
      style={{
        backgroundImage: 'radial-gradient(#E5E7EB 1px, transparent 1px)',
        backgroundSize: '14px 14px',
        maskImage: 'radial-gradient(circle at top right, black, transparent 70%)',
        WebkitMaskImage: 'radial-gradient(circle at top right, black, transparent 70%)',
      }}
    />
  );
}

// ── SOCIAL FIELD ─────────────────────────────────────────────────────────────

function SocialField({
  id,
  icon,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <label htmlFor={id} className="block text-sm font-medium text-[#3D3D3D] mb-1.5 inline-flex items-center gap-1.5">
        <span className="w-5 h-5 rounded-full bg-[#F3F4F6] flex items-center justify-center text-[#6B7280]">
          {icon}
        </span>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full h-10 pl-3.5 pr-10 rounded-lg border border-[#E5E7EB] bg-white text-sm text-[#111111] placeholder:text-[#D1D5DB] transition-colors focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]"
        />
        {value && (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md flex items-center justify-center text-[#9CA3AF] hover:text-[#0F766E] hover:bg-[#0F766E]/5 transition-colors"
            aria-label="open"
          >
            <LinkIcon size={12} />
          </a>
        )}
      </div>
    </div>
  );
}

// ── NUMBER STEPPER ───────────────────────────────────────────────────────────

function NumberStepper({
  label,
  unit,
  value,
  onChange,
  min = 0,
  step = 1,
  hint,
}: {
  label: string;
  unit: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  step?: number;
  hint?: string;
}) {
  const dec = () => onChange(Math.max(min, value - step));
  const inc = () => onChange(value + step);

  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 hover:border-[#0F766E]/40 transition-colors">
      <p className="text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF] font-medium">{label}</p>
      <div className="flex items-end justify-between mt-2 gap-3">
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className="font-display text-[40px] leading-none font-light text-[#111111] tabular-nums">
            {value}
          </span>
          <span className="text-xs text-[#6B7280] font-medium">{unit}</span>
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            type="button"
            onClick={dec}
            disabled={value <= min}
            className="w-8 h-8 rounded-lg border border-[#E5E7EB] flex items-center justify-center text-[#6B7280] hover:border-[#0F766E] hover:text-[#0F766E] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <Minus size={12} />
          </button>
          <button
            type="button"
            onClick={inc}
            className="w-8 h-8 rounded-lg border border-[#E5E7EB] flex items-center justify-center text-[#6B7280] hover:border-[#0F766E] hover:text-[#0F766E] transition-colors cursor-pointer"
          >
            <Plus size={12} />
          </button>
        </div>
      </div>
      {hint && (
        <p className="text-[11px] text-[#9CA3AF] mt-2 leading-snug">{hint}</p>
      )}
    </div>
  );
}

// ── TIME SLOT INPUT ──────────────────────────────────────────────────────────

function TimeSlotInput({
  value,
  onChange,
  compact,
}: {
  value: string;
  onChange: (v: string) => void;
  compact?: boolean;
}) {
  return (
    <input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`tabular-nums font-medium text-[#111111] bg-white border border-[#E5E7EB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] transition-colors hover:border-[#9CA3AF] ${
        compact ? 'h-7 px-1.5 text-[11px]' : 'h-9 px-2.5 text-xs'
      }`}
    />
  );
}
