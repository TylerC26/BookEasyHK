'use client';

import { useEffect, useMemo, useState, useCallback, useRef, forwardRef } from 'react';
import {
  Plus, Save, Trash2, ImagePlus, X, Check,
  ArrowUp, ArrowDown, Eye, EyeOff, BriefcaseBusiness,
  Clock, Camera, ExternalLink,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n/context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { uploadBusinessImage } from '@/lib/business-images';
import { formatPrice, getBusinessTypeEmoji } from '@/lib/utils';
import type { Business, Service } from '@/lib/types';

export default function ServicesSettingsPage() {
  const { t, locale } = useI18n();
  const zh = locale === 'zh-HK';

  const [business, setBusiness] = useState<Business | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

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
      .order('sort_order');
    setServices(svc || []);
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
    setSaveError('');

    const supabase = createClient();
    for (const [idx, svc] of services.entries()) {
      const payload = {
        name: svc.name,
        name_zh: svc.name_zh,
        duration_minutes: svc.duration_minutes,
        price_hkd: svc.pricing_type === 'tbc' ? null : svc.price_hkd,
        pricing_type: svc.pricing_type,
        active: svc.active,
        sort_order: idx,
        allow_customer_image: svc.allow_customer_image,
        image_url: svc.image_url,
      };

      if (svc.id.startsWith('new-')) {
        const { error } = await supabase.from('services').insert({
          business_id: business.id,
          ...payload,
        });
        if (error) {
          setSaveError(error.message);
          setSaving(false);
          return;
        }
      } else {
        const { error } = await supabase
          .from('services')
          .update(payload)
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
    setTimeout(() => setSaved(false), 2400);
    loadData();
  };

  const addService = () => {
    const newId = `new-${Date.now()}`;
    setServices((cur) => [
      ...cur,
      {
        id: newId,
        business_id: business?.id || '',
        name: '',
        name_zh: null,
        duration_minutes: 60,
        price_hkd: null,
        pricing_type: 'fixed',
        active: true,
        sort_order: cur.length,
        allow_customer_image: false,
        image_url: null,
        created_at: new Date().toISOString(),
      },
    ]);
    setExpanded((cur) => ({ ...cur, [newId]: true }));
    // Scroll into view after the next paint.
    setTimeout(() => {
      cardRefs.current[newId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
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
      if (!confirm(zh ? '確定刪除此服務？' : 'Remove this service?')) return;
      const supabase = createClient();
      await supabase.from('services').update({ active: false }).eq('id', svc.id);
    }
    setServices(services.filter((_, i) => i !== idx));
  };

  const updateService = (
    idx: number,
    field: string,
    value: string | number | boolean | null
  ) => {
    const updated = [...services];
    (updated[idx] as unknown as Record<string, unknown>)[field] = value;
    setServices(updated);
  };

  const moveService = (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= services.length) return;
    const updated = [...services];
    [updated[idx], updated[next]] = [updated[next], updated[idx]];
    setServices(updated);
  };

  const toggleExpanded = (id: string) => {
    setExpanded((cur) => ({ ...cur, [id]: !cur[id] }));
  };

  // ── DERIVED ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const active = services.filter((s) => s.active).length;
    const fixed = services.filter((s) => s.pricing_type !== 'tbc' && s.price_hkd != null);
    const avgPrice = fixed.length > 0
      ? Math.round(fixed.reduce((sum, s) => sum + (s.price_hkd || 0), 0) / fixed.length)
      : 0;
    const fixedDur = services.filter((s) => s.duration_minutes > 0);
    const avgDuration = fixedDur.length > 0
      ? Math.round(fixedDur.reduce((sum, s) => sum + s.duration_minutes, 0) / fixedDur.length)
      : 0;
    return { active, total: services.length, avgPrice, avgDuration };
  }, [services]);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted">{t('loading')}</div>;
  }

  return (
    <div className="space-y-7 pb-24">
      {/* ── HEADER ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between animate-fade-up">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#9CA3AF] mb-1">
            {zh ? '設定 · 服務目錄' : 'Settings · Service catalogue'}
          </p>
          <h1 className="font-display text-[28px] md:text-[34px] leading-[1.05] font-light text-[#111111]">
            {zh ? '你的服務' : 'Your services'}<span className="text-[#0F766E]">.</span>
          </h1>
          <p className="text-sm text-[#6B7280] mt-1.5 max-w-xl">
            {zh
              ? '客人預約時會看到這些服務 — 命名、定價、時長要清晰。'
              : 'Everything customers see when they pick what to book — keep names, prices, and durations crisp.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {business?.slug && (
            <a
              href={`/book/${business.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-[#E5E7EB] text-[#6B7280] hover:border-[#0F766E] hover:text-[#0F766E] transition-colors"
            >
              <ExternalLink size={13} />
              {zh ? '預覽' : 'Preview'}
            </a>
          )}
          <Button size="sm" variant="outline" onClick={addService}>
            <Plus size={14} /> {t('addService')}
          </Button>
        </div>
      </div>

      {/* ── KPI STRIP ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-up" style={{ animationDelay: '60ms' }}>
        <SummaryCard
          eyebrow={zh ? '上架中' : 'Live'}
          value={stats.active}
          color="#0F766E"
          hint={zh ? `${stats.total} 個服務` : `of ${stats.total} services`}
        />
        <SummaryCard
          eyebrow={zh ? '隱藏' : 'Hidden'}
          value={stats.total - stats.active}
          color="#9CA3AF"
          hint={zh ? '不會顯示給客人' : 'Not shown to customers'}
        />
        <SummaryCard
          eyebrow={zh ? '平均價格' : 'Avg price'}
          value={stats.avgPrice}
          format="currency"
          color="#111111"
          hint={zh ? '已定價服務' : 'Fixed-price services'}
        />
        <SummaryCard
          eyebrow={zh ? '平均時長' : 'Avg duration'}
          value={stats.avgDuration}
          suffix={zh ? '分鐘' : 'min'}
          color="#111111"
        />
      </div>

      {/* ── SAVE ERROR ─────────────────────────────────────────── */}
      {saveError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 animate-fade-up">
          <strong className="font-medium">{zh ? '儲存失敗：' : 'Save failed: '}</strong>{saveError}
        </div>
      )}

      {/* ── SERVICE LIST ───────────────────────────────────────── */}
      {services.length === 0 ? (
        <EmptyState zh={zh} onAdd={addService} typeEmoji={getBusinessTypeEmoji(business?.type || '')} />
      ) : (
        <div className="space-y-3 animate-fade-up" style={{ animationDelay: '120ms' }}>
          {services.map((svc, idx) => (
            <ServiceCard
              key={svc.id}
              ref={(el) => { cardRefs.current[svc.id] = el; }}
              service={svc}
              index={idx}
              total={services.length}
              expanded={!!expanded[svc.id] || svc.id.startsWith('new-')}
              uploading={uploadingIdx === idx}
              uploadError={uploadingIdx === idx ? '' : uploadError}
              zh={zh}
              t={t}
              typeEmoji={getBusinessTypeEmoji(business?.type || '')}
              onUpdate={(field, value) => updateService(idx, field, value)}
              onRemove={() => removeService(idx)}
              onMoveUp={idx > 0 ? () => moveService(idx, -1) : undefined}
              onMoveDown={idx < services.length - 1 ? () => moveService(idx, 1) : undefined}
              onToggleExpanded={() => toggleExpanded(svc.id)}
              onImageUpload={(file) => handleImageUpload(idx, file)}
            />
          ))}
        </div>
      )}

      {/* ── STICKY SAVE BAR ───────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 lg:left-56 right-0 bg-white/95 backdrop-blur border-t border-[#E5E7EB] z-40">
        <div className="px-5 lg:px-8 py-3 flex items-center justify-between gap-3">
          <p className="text-xs text-[#9CA3AF] hidden sm:block">
            {saved
              ? (zh ? '已儲存 · 即時更新' : 'Saved · live on your booking page')
              : (zh ? '完成編輯後別忘記儲存。' : 'Remember to save your changes.')}
          </p>
          <div className="flex items-center gap-2 ml-auto">
            <Button size="sm" variant="outline" onClick={addService}>
              <Plus size={14} /> {t('addService')}
            </Button>
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

// ── SUMMARY CARD ─────────────────────────────────────────────────────────────

function SummaryCard({
  eyebrow,
  value,
  suffix,
  hint,
  color,
  format: fmt,
}: {
  eyebrow: string;
  value: number;
  suffix?: string;
  hint?: string;
  color: string;
  format?: 'currency';
}) {
  const display = fmt === 'currency'
    ? (value === 0 ? 'HK$—' : formatPrice(value))
    : value.toString();
  const dim = value === 0;
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF] font-medium">{eyebrow}</p>
        <span className="w-1.5 h-1.5 rounded-full mt-1.5" style={{ background: dim ? '#E5E7EB' : color }} />
      </div>
      <div className="flex items-baseline gap-1.5 mt-2">
        <span
          className="font-display text-[36px] leading-none font-light tabular-nums"
          style={{ color: dim ? '#D1D5DB' : '#111111' }}
        >
          {display}
        </span>
        {suffix && <span className="text-xs text-[#6B7280] font-medium">{suffix}</span>}
      </div>
      {hint && <p className="text-[11px] text-[#9CA3AF] mt-2 tracking-wide">{hint}</p>}
    </Card>
  );
}

// ── EMPTY STATE ──────────────────────────────────────────────────────────────

function EmptyState({
  zh,
  onAdd,
  typeEmoji,
}: {
  zh: boolean;
  onAdd: () => void;
  typeEmoji: string;
}) {
  return (
    <Card className="relative overflow-hidden p-12 text-center animate-fade-up">
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.4] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(#E5E7EB 1px, transparent 1px)',
          backgroundSize: '14px 14px',
          maskImage: 'radial-gradient(circle at center, black, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(circle at center, black, transparent 75%)',
        }}
      />
      <div className="relative">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#0F766E]/10 mb-4 text-2xl">
          {typeEmoji || <BriefcaseBusiness className="text-[#0F766E]" size={26} />}
        </div>
        <p className="font-display text-2xl font-light text-[#111111]">
          {zh ? '還沒有服務' : 'No services yet.'}
        </p>
        <p className="text-sm text-[#6B7280] mt-1.5 max-w-md mx-auto">
          {zh
            ? '加入你的第一項服務，客人就能開始預約。'
            : 'Add your first service so customers have something to book.'}
        </p>
        <div className="mt-5">
          <Button onClick={onAdd}>
            <Plus size={14} /> {zh ? '新增第一個服務' : 'Add your first service'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ── SERVICE CARD ─────────────────────────────────────────────────────────────

interface ServiceCardProps {
  service: Service;
  index: number;
  total: number;
  expanded: boolean;
  uploading: boolean;
  uploadError?: string;
  zh: boolean;
  t: ReturnType<typeof useI18n>['t'];
  typeEmoji: string;
  onUpdate: (field: string, value: string | number | boolean | null) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onToggleExpanded: () => void;
  onImageUpload: (file: File) => void;
}

const ServiceCard = forwardRef<HTMLDivElement, ServiceCardProps>(function ServiceCard(
  {
    service: svc,
    index,
    total,
    expanded,
    uploading,
    uploadError,
    zh,
    t,
    typeEmoji,
    onUpdate,
    onRemove,
    onMoveUp,
    onMoveDown,
    onToggleExpanded,
    onImageUpload,
  },
  ref
) {
    const isFixed = svc.pricing_type !== 'tbc';
    const accent = svc.active ? '#0F766E' : '#9CA3AF';
    const previewName = svc.name || (zh ? '未命名服務' : 'Untitled service');

    return (
      <div
        ref={ref}
        className={`relative bg-white rounded-2xl border transition-all overflow-hidden ${
          svc.active
            ? 'border-[#E5E7EB] hover:border-[#0F766E]/40 hover:shadow-sm'
            : 'border-[#E5E7EB] opacity-75'
        }`}
      >
        {/* status edge */}
        <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: accent }} />

        {/* COLLAPSED HEADER */}
        <div className="pl-5 pr-3 py-3.5 flex items-center gap-3.5">
          {/* image / placeholder */}
          <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-[#E5E7EB] bg-[#FAFAF8] shrink-0">
            {svc.image_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={svc.image_url} alt={svc.name || 'Service'} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl">
                {typeEmoji}
              </div>
            )}
          </div>

          {/* main info */}
          <button
            type="button"
            onClick={onToggleExpanded}
            className="flex-1 min-w-0 text-left cursor-pointer"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-display text-[17px] font-light text-[#111111] truncate">
                {previewName}
              </span>
              {svc.name_zh && (
                <span className="text-xs text-[#9CA3AF] truncate">{svc.name_zh}</span>
              )}
              {!svc.active && (
                <span className="text-[9px] uppercase tracking-[0.2em] text-[#9CA3AF] border border-[#E5E7EB] px-1.5 py-0.5 rounded">
                  {zh ? '隱藏' : 'Hidden'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-[12px] text-[#6B7280]">
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Clock size={11} className="text-[#9CA3AF]" />
                {svc.duration_minutes} {zh ? '分鐘' : 'min'}
              </span>
              <span className="inline-flex items-center gap-1 font-medium text-[#0F766E] tabular-nums">
                {isFixed
                  ? (svc.price_hkd != null ? formatPrice(svc.price_hkd) : '—')
                  : (zh ? '待定 · TBC' : 'TBC')}
              </span>
              {svc.allow_customer_image && (
                <span className="inline-flex items-center gap-1 text-[#9CA3AF]">
                  <Camera size={10} /> {zh ? '允許附圖' : 'Photo'}
                </span>
              )}
            </div>
          </button>

          {/* row controls */}
          <div className="flex items-center gap-0.5 shrink-0">
            <ReorderButton onClick={onMoveUp} disabled={!onMoveUp} dir="up" />
            <ReorderButton onClick={onMoveDown} disabled={!onMoveDown} dir="down" />
            <span className="text-[10px] text-[#D1D5DB] tabular-nums px-1">
              {index + 1}/{total}
            </span>
            <button
              type="button"
              onClick={() => onUpdate('active', !svc.active)}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                svc.active
                  ? 'text-[#0F766E] hover:bg-[#0F766E]/10'
                  : 'text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#111111]'
              }`}
              title={svc.active ? (zh ? '隱藏' : 'Hide') : (zh ? '顯示' : 'Show')}
            >
              {svc.active ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
            <button
              type="button"
              onClick={onToggleExpanded}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:text-[#111111] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
              title={expanded ? (zh ? '收起' : 'Collapse') : (zh ? '編輯' : 'Edit')}
            >
              <ChevronDown size={14} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* EXPANDED BODY */}
        {expanded && (
          <div className="px-5 pb-5 pt-1 grid grid-cols-1 lg:grid-cols-12 gap-5 border-t border-dashed border-[#E5E7EB]">
            {/* Image uploader */}
            <div className="lg:col-span-4 mt-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF] mb-2">
                {zh ? '服務圖片' : 'Service photo'}
              </p>
              <label className="relative block aspect-[4/3] rounded-xl overflow-hidden border-2 border-dashed border-[#D1D5DB] bg-[#FAFAF8] cursor-pointer hover:border-[#0F766E] transition-colors group">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onImageUpload(file);
                    e.target.value = '';
                  }}
                />
                {svc.image_url ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={svc.image_url} alt={svc.name || 'Service'} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/35 transition-colors flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1.5 text-white text-xs font-medium bg-black/50 backdrop-blur px-3 py-1.5 rounded-full">
                        <ImagePlus size={12} />
                        {zh ? '更換圖片' : 'Replace'}
                      </div>
                    </div>
                  </>
                ) : uploading ? (
                  <div className="w-full h-full flex items-center justify-center text-xs text-[#6B7280] animate-pulse">
                    {zh ? '上傳中...' : 'Uploading…'}
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-[#6B7280]">
                    <ImagePlus size={20} />
                    <span className="text-xs">{zh ? '加入圖片' : 'Add photo'}</span>
                  </div>
                )}
              </label>
              {svc.image_url && (
                <button
                  type="button"
                  onClick={() => onUpdate('image_url', null)}
                  className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-[#9CA3AF] hover:text-red-500 transition-colors"
                >
                  <X size={11} /> {zh ? '移除圖片' : 'Remove photo'}
                </button>
              )}
              {uploadError && (
                <p className="text-xs text-red-500 mt-1">{uploadError}</p>
              )}
            </div>

            {/* Fields */}
            <div className="lg:col-span-8 mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  id={`svc-${svc.id}-name`}
                  label={t('serviceName')}
                  value={svc.name}
                  onChange={(e) => onUpdate('name', e.target.value)}
                  placeholder={zh ? '例：基本修甲' : 'e.g. Classic Manicure'}
                />
                <Input
                  id={`svc-${svc.id}-zh`}
                  label={t('serviceNameZh')}
                  value={svc.name_zh || ''}
                  onChange={(e) => onUpdate('name_zh', e.target.value)}
                  placeholder={zh ? '中文名稱' : 'Optional Chinese name'}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Duration with quick-pick chips */}
                <div className="space-y-1.5">
                  <label htmlFor={`svc-${svc.id}-dur`} className="block text-sm font-medium text-[#3D3D3D]">
                    {t('duration')}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id={`svc-${svc.id}-dur`}
                      type="number"
                      min={15}
                      step={15}
                      value={svc.duration_minutes}
                      onChange={(e) => onUpdate('duration_minutes', parseInt(e.target.value) || 60)}
                      className="w-24 h-10 px-3 rounded-lg border border-[#E5E7EB] bg-white text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]"
                    />
                    <div className="flex gap-1 flex-wrap">
                      {[30, 60, 90, 120].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => onUpdate('duration_minutes', m)}
                          className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                            svc.duration_minutes === m
                              ? 'bg-[#111111] text-white'
                              : 'border border-[#E5E7EB] text-[#6B7280] hover:border-[#0F766E] hover:text-[#0F766E]'
                          }`}
                        >
                          {m}m
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Price */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor={`svc-${svc.id}-price`} className="block text-sm font-medium text-[#3D3D3D]">
                      {t('price')}
                    </label>
                    <PricingToggle
                      value={svc.pricing_type}
                      onChange={(v) => {
                        onUpdate('pricing_type', v);
                        if (v === 'tbc') onUpdate('price_hkd', null);
                      }}
                      zh={zh}
                    />
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] text-sm pointer-events-none">
                      HK$
                    </span>
                    <input
                      id={`svc-${svc.id}-price`}
                      type="number"
                      min={0}
                      disabled={!isFixed}
                      value={!isFixed ? '' : (svc.price_hkd ?? '')}
                      placeholder={!isFixed ? (zh ? '確認時輸入' : 'Set on confirm') : '0'}
                      onChange={(e) => onUpdate('price_hkd', parseInt(e.target.value) || null)}
                      className="w-full h-10 pl-12 pr-3 rounded-lg border border-[#E5E7EB] bg-white text-sm tabular-nums disabled:bg-[#F9FAFB] disabled:text-[#9CA3AF] disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]"
                    />
                  </div>
                  <p className="text-[11px] text-[#9CA3AF] leading-snug">
                    {isFixed
                      ? (zh ? '所有預約以此價格收費。' : 'Charge this for every booking.')
                      : (zh ? '客人預約時看到「待確認」，你在確認時輸入最終金額。' : 'Customers see "TBC". You enter the final price when confirming.')}
                  </p>
                </div>
              </div>

              {/* Customer image toggle */}
              <div className="flex items-center justify-between rounded-xl border border-[#E5E7EB] bg-[#FAFAF8] px-4 py-3">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="w-8 h-8 rounded-full bg-white border border-[#E5E7EB] flex items-center justify-center text-[#6B7280] shrink-0">
                    <Camera size={14} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#111111]">
                      {zh ? '允許客戶上傳圖片' : 'Allow customer photos'}
                    </p>
                    <p className="text-[11px] text-[#9CA3AF] leading-snug mt-0.5">
                      {zh
                        ? '例如美甲款式、髮型、寵物造型等參考圖。'
                        : 'Lets customers attach a reference shot — handy for nails, hair, grooming.'}
                    </p>
                  </div>
                </div>
                <Toggle
                  checked={svc.allow_customer_image}
                  onChange={() => onUpdate('allow_customer_image', !svc.allow_customer_image)}
                />
              </div>

              {/* Footer actions */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={onRemove}
                  className="inline-flex items-center gap-1.5 text-xs text-[#9CA3AF] hover:text-red-500 transition-colors cursor-pointer"
                >
                  <Trash2 size={13} />
                  {zh ? '刪除服務' : 'Remove service'}
                </button>
                <button
                  type="button"
                  onClick={onToggleExpanded}
                  className="text-[10px] uppercase tracking-[0.18em] text-[#9CA3AF] hover:text-[#111111] cursor-pointer"
                >
                  {zh ? '收起' : 'Collapse'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
  );
});

// ── REORDER BUTTON ───────────────────────────────────────────────────────────

function ReorderButton({
  onClick,
  disabled,
  dir,
}: {
  onClick?: () => void;
  disabled?: boolean;
  dir: 'up' | 'down';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-7 h-7 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:text-[#111111] hover:bg-[#F3F4F6] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
      aria-label={dir === 'up' ? 'Move up' : 'Move down'}
    >
      {dir === 'up' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
    </button>
  );
}

// ── PRICING TOGGLE ───────────────────────────────────────────────────────────

function PricingToggle({
  value,
  onChange,
  zh,
}: {
  value: 'fixed' | 'tbc';
  onChange: (v: 'fixed' | 'tbc') => void;
  zh: boolean;
}) {
  return (
    <div className="inline-flex p-0.5 bg-[#F3F4F6] rounded-md">
      <button
        type="button"
        onClick={() => onChange('fixed')}
        className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-all cursor-pointer ${
          value !== 'tbc' ? 'bg-white text-[#0F766E] shadow-sm' : 'text-[#6B7280] hover:text-[#111111]'
        }`}
      >
        {zh ? '固定' : 'Fixed'}
      </button>
      <button
        type="button"
        onClick={() => onChange('tbc')}
        className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-all cursor-pointer ${
          value === 'tbc' ? 'bg-white text-[#0F766E] shadow-sm' : 'text-[#6B7280] hover:text-[#111111]'
        }`}
      >
        TBC
      </button>
    </div>
  );
}

// ── TOGGLE ───────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none shrink-0 ${
        checked ? 'bg-[#0F766E]' : 'bg-[#E5E7EB]'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-[18px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

// ── INLINE CHEVRON ───────────────────────────────────────────────────────────

function ChevronDown({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
