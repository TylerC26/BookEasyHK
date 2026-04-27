'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { parseBusinessSocialLinks } from '@/lib/business-profile';
import { I18nProvider, useI18n } from '@/lib/i18n/context';
import { LanguageToggle } from '@/components/language-toggle';
import { formatPrice, formatTime, addMinutesToTime, timeToMinutes, getBusinessTypeEmoji } from '@/lib/utils';
import type { BookingQuestion, Business, Service, WorkingHours } from '@/lib/types';
import {
  format, addDays, isBefore, startOfDay, isToday,
  startOfMonth, endOfMonth, eachDayOfInterval, getDay,
  addMonths, subMonths, isSameDay, isSameMonth,
} from 'date-fns';
import {
  Check, ChevronLeft, ChevronRight, Calendar, ArrowRight, Clock, MapPin,
  ExternalLink, Users, Timer, ImagePlus, X, ShieldCheck, MessageCircle,
  Phone as PhoneIcon, Sparkles,
} from 'lucide-react';

type BookingStep = 'select' | 'confirm' | 'done';

/** Extends TimeSlot with a waitlistable flag.
 * waitlistable = true  → slot is fully booked but NOT blocked by the business,
 *                        so the customer may join the waitlist.
 * waitlistable = false → slot is blocked by the business or during break;
 *                        no waitlist option shown.
 */
type SlotInfo = { time: string; available: boolean; waitlistable: boolean };

const SOCIAL_LABELS = {
  instagram: 'Instagram',
  threads: 'Threads',
  facebook: 'Facebook',
  other: 'Link',
} as const;

// ── Step rail ────────────────────────────────────────────────────────────────
function StepRail({ step, zh }: { step: BookingStep; zh: boolean }) {
  const steps: { key: BookingStep; en: string; zh: string }[] = [
    { key: 'select', en: 'Select', zh: '選擇' },
    { key: 'confirm', en: 'Confirm', zh: '確認' },
  ];
  const activeIdx = steps.findIndex((s) => s.key === step);

  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((s, i) => {
        const done = activeIdx > i;
        const active = activeIdx === i;
        return (
          <div key={s.key} className="flex items-center gap-2 flex-1 last:flex-none">
            <div className="flex items-baseline gap-1.5 shrink-0">
              <span
                className={`font-display text-[15px] font-light tabular-nums leading-none transition-colors ${
                  active
                    ? 'text-[#0F766E]'
                    : done
                      ? 'text-[#0F766E]'
                      : 'text-[#9CA3AF]'
                }`}
              >
                {(i + 1).toString().padStart(2, '0')}
              </span>
              <span
                className={`text-[10px] uppercase tracking-[0.2em] transition-colors ${
                  active
                    ? 'text-[#111111] font-medium'
                    : done
                      ? 'text-[#0F766E]'
                      : 'text-[#9CA3AF]'
                }`}
              >
                {zh ? s.zh : s.en}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="flex-1 h-px bg-[#E5E7EB] relative overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-[#0F766E] transition-all duration-300"
                  style={{ width: done ? '100%' : active ? '50%' : '0%' }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Hero (editorial) ─────────────────────────────────────────────────────────
function HeroCard({
  business,
  zh,
  collapsed,
}: {
  business: Business;
  zh: boolean;
  collapsed: boolean;
}) {
  const emoji = getBusinessTypeEmoji(business.type);
  return (
    <div className="relative">
      {/* Cover */}
      <div
        className={`rounded-2xl overflow-hidden bg-[#F3F4F6] transition-all duration-300 ease-out ${
          collapsed ? 'aspect-[16/4] opacity-90' : 'aspect-[16/9]'
        }`}
      >
        {business.business_image_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={business.business_image_url}
            alt={business.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#CCFBF1] to-[#5EEAD4] flex items-center justify-center text-5xl">
            {emoji}
          </div>
        )}
        {/* gradient veil for legibility under overlapping card */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
      </div>

      {/* Identity card */}
      <div className="-mt-10 mx-3 bg-white rounded-2xl border border-[#E5E7EB] shadow-sm px-4 py-3.5 flex items-center gap-3 relative">
        <div className="w-12 h-12 rounded-xl overflow-hidden border border-[#E5E7EB] bg-white shrink-0 flex items-center justify-center">
          {business.logo_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={business.logo_url} alt={business.name} className="w-full h-full object-cover" />
          ) : business.business_image_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={business.business_image_url} alt={business.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-xl">{emoji}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] uppercase tracking-[0.22em] text-[#9CA3AF] mb-0.5">
            {zh ? '預約' : 'Book a visit'}
          </p>
          <h1 className="font-display text-[18px] leading-tight font-light text-[#111111] truncate">
            {business.name}<span className="text-[#0F766E]">.</span>
          </h1>
          {(business.district || business.address_text) && (
            <p className="text-[11px] text-[#6B7280] mt-0.5 truncate inline-flex items-center gap-1">
              <MapPin size={10} className="text-[#0F766E] shrink-0" />
              <span className="truncate">{business.district || business.address_text}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Service tile ─────────────────────────────────────────────────────────────
function ServiceGrid({
  services,
  selected,
  onSelect,
  emoji,
  zh,
}: {
  services: Service[];
  selected: Service | null;
  onSelect: (s: Service) => void;
  emoji: string;
  zh: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {services.map((svc) => {
        const isSelected = selected?.id === svc.id;
        return (
          <button
            key={svc.id}
            onClick={() => onSelect(svc)}
            className={`group relative text-left bg-white rounded-2xl overflow-hidden border transition-all cursor-pointer ${
              isSelected
                ? 'border-[#0F766E] ring-2 ring-[#0F766E]/15 shadow-sm'
                : 'border-[#E5E7EB] hover:border-[#0F766E]/40 hover:shadow-sm'
            }`}
          >
            <div className={`relative aspect-[5/4] flex items-center justify-center overflow-hidden ${
              svc.image_url ? 'bg-[#F3F4F6]' : 'bg-gradient-to-br from-[#FAFAF8] to-[#F3F4F6]'
            }`}>
              {svc.image_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={svc.image_url}
                  alt={svc.name}
                  className="w-full h-full object-cover transition-transform group-hover:scale-[1.02]"
                />
              ) : (
                <span className="text-3xl opacity-90" aria-hidden>
                  {emoji}
                </span>
              )}
              {isSelected && (
                <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#0F766E] text-white flex items-center justify-center shadow-sm">
                  <Check size={13} strokeWidth={3} />
                </div>
              )}
              {!isSelected && (
                <div className="absolute top-2 right-2 text-[9px] uppercase tracking-[0.18em] text-[#9CA3AF] bg-white/85 backdrop-blur-sm border border-[#E5E7EB] px-1.5 py-0.5 rounded-full inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Clock size={9} /> {svc.duration_minutes}{zh ? '分' : 'm'}
                </div>
              )}
            </div>
            <div className="px-3 py-2.5">
              <p className="text-[13px] font-medium text-[#111111] leading-tight line-clamp-1">
                {svc.name}
              </p>
              {svc.name_zh && (
                <p className="text-[11px] text-[#6B7280] mt-0.5 line-clamp-1">{svc.name_zh}</p>
              )}
              <div className="flex items-center justify-between mt-1.5">
                {svc.pricing_type === 'tbc' ? (
                  <span className="text-[10px] uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                    {zh ? '待定' : 'TBC'}
                  </span>
                ) : svc.price_hkd ? (
                  <span className="font-display text-[15px] font-light text-[#0F766E] tabular-nums">
                    {formatPrice(svc.price_hkd)}
                  </span>
                ) : (
                  <span />
                )}
                <span className="text-[10px] text-[#9CA3AF] tabular-nums inline-flex items-center gap-0.5">
                  <Clock size={9} /> {svc.duration_minutes}{zh ? '分' : 'm'}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Selected service row ─────────────────────────────────────────────────────
function SelectedServiceRow({
  service,
  emoji,
  zh,
}: {
  service: Service;
  emoji: string;
  zh: boolean;
}) {
  return (
    <div className="relative bg-white rounded-2xl border border-[#0F766E] ring-2 ring-[#0F766E]/10 overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#0F766E]" />
      <div className="pl-4 pr-3 py-3 flex items-center gap-3">
        <div className={`relative w-12 h-12 rounded-xl flex items-center justify-center shrink-0 overflow-hidden ${
          service.image_url ? 'bg-[#F3F4F6]' : 'bg-gradient-to-br from-[#CCFBF1] to-[#5EEAD4]'
        }`}>
          {service.image_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={service.image_url} alt={service.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-xl">{emoji}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF]">
            {zh ? '已選服務' : 'Selected'}
          </p>
          <p className="font-display text-[15px] font-light text-[#111111] truncate leading-tight mt-0.5">
            {service.name}
          </p>
          <span className="mt-0.5 text-[10px] text-[#9CA3AF] tabular-nums inline-flex items-center gap-1">
            <Clock size={9} /> {service.duration_minutes}{zh ? '分' : 'm'}
            {service.name_zh && (
              <>
                <span>·</span>
                <span className="truncate">{service.name_zh}</span>
              </>
            )}
          </span>
        </div>
        <div className="shrink-0 pr-1">
          {service.pricing_type === 'tbc' ? (
            <span className="text-[10px] uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
              {zh ? '待定' : 'TBC'}
            </span>
          ) : service.price_hkd ? (
            <span className="font-display text-[18px] font-light text-[#0F766E] tabular-nums">
              {formatPrice(service.price_hkd)}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── Selected date/time row ───────────────────────────────────────────────────
function SelectedDateTimeRow({
  date,
  time,
  endTime,
  isWaitlist,
  zh,
}: {
  date: Date;
  time: string;
  endTime: string | null;
  isWaitlist: boolean;
  zh: boolean;
}) {
  const accent = isWaitlist ? '#D97706' : '#0F766E';
  return (
    <div
      className="relative bg-white rounded-2xl border overflow-hidden"
      style={{ borderColor: accent, boxShadow: `0 0 0 2px ${accent}15` }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: accent }} />
      <div className="pl-4 pr-3 py-3 flex items-center gap-3">
        <div className="text-center shrink-0 pr-3 border-r border-dashed border-[#E5E7EB]">
          <p className="text-[9px] uppercase tracking-[0.22em] text-[#9CA3AF]">
            {format(date, 'EEE')}
          </p>
          <p
            className="font-display text-[28px] leading-none font-light tabular-nums mt-0.5"
            style={{ color: accent }}
          >
            {format(date, 'd')}
          </p>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF]">
            {zh ? '已選時間' : 'Selected'}
          </p>
          <p className="font-display text-[15px] font-light text-[#111111] truncate leading-tight mt-0.5 tabular-nums">
            {formatTime(time)}{endTime ? <span className="text-[#9CA3AF]"> → {formatTime(endTime)}</span> : ''}
          </p>
          <p className="text-[10px] text-[#9CA3AF] mt-0.5 truncate">
            {format(date, zh ? 'M月d日 EEEE' : 'EEEE, MMM d')}
          </p>
        </div>
        {isWaitlist && (
          <span
            className="shrink-0 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded-full"
            style={{ background: '#FEF3C7', color: '#92400E' }}
          >
            <Users size={10} /> {zh ? '輪候' : 'Waitlist'}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Date strip ───────────────────────────────────────────────────────────────
function DateStrip({
  selectedDate,
  onSelect,
  maxDate,
  zh,
}: {
  selectedDate: Date;
  onSelect: (d: Date) => void;
  maxDate: Date;
  zh: boolean;
}) {
  const today = startOfDay(new Date());
  const dayLabelsZh = ['日', '一', '二', '三', '四', '五', '六'];
  const dayLabelsEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const labels = zh ? dayLabelsZh : dayLabelsEn;

  const days = useMemo(() => {
    const out: Date[] = [];
    for (let i = 0; i < 14; i++) {
      const d = addDays(today, i);
      if (isBefore(maxDate, d)) break;
      out.push(d);
    }
    return out;
  }, [today, maxDate]);

  const scrollerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollerRef.current?.querySelector<HTMLButtonElement>('[data-selected="true"]');
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [selectedDate]);

  return (
    <div
      ref={scrollerRef}
      className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory scroll-smooth"
      style={{ scrollbarWidth: 'none' }}
    >
      {days.map((day) => {
        const isSelected = isSameDay(day, selectedDate);
        const todayDay = isToday(day);
        const isWeekend = getDay(day) === 0 || getDay(day) === 6;
        return (
          <button
            key={day.toISOString()}
            data-selected={isSelected}
            onClick={() => onSelect(day)}
            className={`shrink-0 snap-start w-[52px] py-2.5 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all border ${
              isSelected
                ? 'bg-[#111111] border-[#111111] text-white'
                : 'bg-white border-[#E5E7EB] text-[#3D3D3D] hover:border-[#0F766E]/40'
            }`}
          >
            <span
              className={`text-[9px] uppercase tracking-[0.18em] leading-none ${
                isSelected
                  ? 'text-white/70'
                  : isWeekend
                    ? 'text-[#9CA3AF]'
                    : 'text-[#6B7280]'
              }`}
            >
              {labels[getDay(day)]}
            </span>
            <span className="font-display text-[18px] font-light leading-none mt-1.5 tabular-nums">
              {format(day, 'd')}
            </span>
            <span
              className={`mt-1 w-1 h-1 rounded-full ${
                todayDay
                  ? isSelected ? 'bg-white' : 'bg-[#0F766E]'
                  : 'bg-transparent'
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

// ── Calendar picker ──────────────────────────────────────────────────────────
function CalendarPicker({
  selectedDate,
  onSelect,
  maxDate,
  zh,
}: {
  selectedDate: Date;
  onSelect: (date: Date) => void;
  maxDate: Date;
  zh: boolean;
}) {
  const [viewMonth, setViewMonth] = useState(new Date(selectedDate));
  const today = startOfDay(new Date());
  const dayLabels = zh
    ? ['日', '一', '二', '三', '四', '五', '六']
    : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = getDay(monthStart);
  const allCells = [...Array(startPad).fill(null), ...days];

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setViewMonth(subMonths(viewMonth, 1))}
          disabled={isBefore(endOfMonth(subMonths(viewMonth, 1)), today)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] hover:bg-[#F3F4F6] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
        <div className="flex items-baseline gap-2">
          <h3 className="font-display text-[18px] font-light text-[#111111] tabular-nums">
            {format(viewMonth, zh ? 'M月' : 'MMMM')}
          </h3>
          <span className="text-[10px] uppercase tracking-[0.18em] text-[#9CA3AF] tabular-nums">
            {format(viewMonth, 'yyyy')}
          </span>
        </div>
        <button
          onClick={() => setViewMonth(addMonths(viewMonth, 1))}
          disabled={isBefore(maxDate, startOfMonth(addMonths(viewMonth, 1)))}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] hover:bg-[#F3F4F6] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {dayLabels.map((d, i) => (
          <div key={`${d}-${i}`} className="text-center text-[10px] uppercase tracking-[0.18em] font-medium text-[#9CA3AF] py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {allCells.map((day, idx) => {
          if (!day) return <div key={`pad-${idx}`} />;
          const isSelected = isSameDay(day, selectedDate);
          const isPast = isBefore(day, today);
          const isFuture = isBefore(maxDate, day);
          const disabled = isPast || isFuture || !isSameMonth(day, viewMonth);
          const todayDay = isToday(day);

          return (
            <button
              key={day.toISOString()}
              onClick={() => { if (!disabled) onSelect(day); }}
              disabled={disabled}
              className={`h-9 flex items-center justify-center text-sm rounded-lg tabular-nums transition-colors ${
                isSelected
                  ? 'bg-[#0F766E] text-white font-medium'
                  : todayDay && !disabled
                    ? 'border border-[#0F766E] text-[#0F766E] font-medium'
                    : disabled
                      ? 'text-[#D1D5DB] cursor-not-allowed'
                      : 'text-[#3D3D3D] hover:bg-[#0F766E]/5 hover:text-[#0F766E]'
              }`}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Section eyebrow ──────────────────────────────────────────────────────────
function SectionHead({
  step,
  title,
  action,
}: {
  step: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between mb-3">
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF] font-medium mb-0.5">
          {step}
        </p>
        <h2 className="font-display text-[18px] font-light text-[#111111] leading-tight">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

// ── Main Booking Flow ───────────────────────────────────────────────────────
function BookingFlow() {
  const { t, locale } = useI18n();
  const zh = locale === 'zh-HK';
  const params = useParams();
  const slug = params.slug as string;

  const [business, setBusiness] = useState<Business | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [bookingQuestions, setBookingQuestions] = useState<BookingQuestion[]>([]);
  const [hours, setHours] = useState<WorkingHours[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [step, setStep] = useState<BookingStep>('select');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<SlotInfo[]>([]);
  const [showFullCalendar, setShowFullCalendar] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [bookingSubmittedMessage, setBookingSubmittedMessage] = useState('');

  const [customerImageUrl, setCustomerImageUrl] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUploadError, setImageUploadError] = useState('');

  const [isWaitlistSlot, setIsWaitlistSlot] = useState(false);
  const [waitlistPosition, setWaitlistPosition] = useState<number | null>(null);

  useEffect(() => { loadBusiness(); }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleQuestions = bookingQuestions
    .filter((question) => selectedService && (question.service_id === null || question.service_id === selectedService.id))
    .sort((a, b) => {
      if (a.service_id === b.service_id) return a.sort_order - b.sort_order;
      if (a.service_id === null) return -1;
      if (b.service_id === null) return 1;
      return a.sort_order - b.sort_order;
    });

  const missingRequiredQuestion = visibleQuestions.find(
    (question) => question.is_required && !questionAnswers[question.id]?.trim()
  );

  const updateQuestionAnswer = (questionId: string, answer: string) => {
    setQuestionAnswers((current) => ({ ...current, [questionId]: answer }));
  };

  const handleImageUpload = async (file: File) => {
    if (!business) return;
    if (!file.type.startsWith('image/')) {
      setImageUploadError(zh ? '請選擇圖片檔案' : 'Please select an image file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setImageUploadError(zh ? '圖片不可超過 10MB' : 'Image must be 10 MB or smaller.');
      return;
    }
    setImageUploading(true);
    setImageUploadError('');
    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${business.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('booking-images')
        .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('booking-images').getPublicUrl(path);
      setCustomerImageUrl(data.publicUrl);
    } catch {
      setImageUploadError(zh ? '上傳失敗，請重試' : 'Upload failed. Please try again.');
    } finally {
      setImageUploading(false);
    }
  };

  const loadBusiness = async () => {
    const supabase = createClient();
    const { data: biz } = await supabase
      .from('businesses')
      .select('*')
      .eq('slug', slug)
      .eq('onboarding_complete', true)
      .single();
    if (!biz) { setNotFound(true); setLoading(false); return; }
    setBusiness(biz);
    const [{ data: svc }, { data: wh }, { data: questionRows }] = await Promise.all([
      supabase.from('services').select('*').eq('business_id', biz.id).eq('active', true).order('sort_order'),
      supabase.from('working_hours').select('*').eq('business_id', biz.id).order('day_of_week'),
      supabase.from('booking_questions').select('*').eq('business_id', biz.id).order('sort_order'),
    ]);
    setServices(svc || []);
    setHours(wh || []);
    setBookingQuestions(
      ((questionRows || []) as BookingQuestion[]).map((question) => ({
        ...question,
        options: Array.isArray(question.options) ? question.options : null,
      }))
    );
    setLoading(false);

    // ── Pre-fill slot from waitlist notification link ─────────────────────
    if (typeof window !== 'undefined' && svc) {
      const urlParams = new URLSearchParams(window.location.search);
      const pDate = urlParams.get('date');
      const pTime = urlParams.get('time');
      const pService = urlParams.get('service');

      if (pDate && pTime && pService) {
        const prefillService = svc.find((s) => s.id === pService);
        if (prefillService) {
          const prefillDate = new Date(`${pDate}T12:00:00`);
          setSelectedService(prefillService);
          setSelectedDate(prefillDate);
          setSelectedTime(pTime);
        }
      }
    }
  };

  const loadSlotsForDate = useCallback(async (date: Date) => {
    if (!business || !selectedService) return;
    const supabase = createClient();
    const dateStr = format(date, 'yyyy-MM-dd');
    const [{ data: bookings }, { data: blocked }] = await Promise.all([
      supabase.from('bookings').select('*').eq('business_id', business.id).eq('booking_date', dateStr).neq('status', 'cancelled'),
      supabase.from('blocked_times').select('*').eq('business_id', business.id).eq('blocked_date', dateStr),
    ]);
    const dayOfWeek = date.getDay();
    const dayHours = hours.find((h) => h.day_of_week === dayOfWeek);
    if (!dayHours || !dayHours.is_open || !dayHours.open_time || !dayHours.close_time) {
      setAvailableSlots([]);
      return;
    }
    const slots: SlotInfo[] = [];
    const openMin = timeToMinutes(dayHours.open_time);
    const closeMin = timeToMinutes(dayHours.close_time);
    const breakStartMin = dayHours.break_start ? timeToMinutes(dayHours.break_start) : null;
    const breakEndMin = dayHours.break_end ? timeToMinutes(dayHours.break_end) : null;
    const duration = selectedService.duration_minutes;
    const buffer = business.buffer_minutes || 0;
    const nowMin = isToday(date)
      ? new Date().getHours() * 60 + new Date().getMinutes() + (business.min_advance_hours * 60)
      : 0;
    for (let startMin = openMin; startMin + duration <= closeMin; startMin += 30) {
      const endMin = startMin + duration;
      const slotTime = `${String(Math.floor(startMin / 60)).padStart(2, '0')}:${String(startMin % 60).padStart(2, '0')}`;
      if (startMin < nowMin) continue;
      const inBreak = breakStartMin !== null && breakEndMin !== null && startMin < breakEndMin && endMin > breakStartMin;
      if (inBreak) continue;
      const hasConflict = (bookings || []).some((b) => {
        const bStart = timeToMinutes(b.start_time);
        const bEnd = timeToMinutes(b.end_time) + buffer;
        return startMin < bEnd && endMin > bStart;
      });
      const isBlocked = (blocked || []).some((b) => {
        const bStart = timeToMinutes(b.start_time);
        const bEnd = timeToMinutes(b.end_time);
        return startMin < bEnd && endMin > bStart;
      });
      slots.push({
        time: slotTime,
        available: !hasConflict && !isBlocked,
        waitlistable: hasConflict && !isBlocked,
      });
    }
    setAvailableSlots(slots);
  }, [business, selectedService, hours]);

  useEffect(() => {
    if (step === 'select' && selectedService) loadSlotsForDate(selectedDate);
  }, [selectedDate, step, selectedService, loadSlotsForDate]);

  const handleSubmit = async () => {
    if (!business || !selectedService || !selectedTime) return;
    setSubmitting(true);
    setBookingError('');
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: business.id,
          service_id: selectedService.id,
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_whatsapp: customerPhone,
          customer_notes: customerNotes || null,
          customer_image_url: customerImageUrl || null,
          answers: visibleQuestions
            .map((question) => ({
              question_id: question.id,
              answer_text: questionAnswers[question.id]?.trim() || '',
            }))
            .filter((answer) => answer.answer_text),
          booking_date: dateStr,
          start_time: selectedTime,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setBookingError(payload.error || (zh ? '預約失敗，請重試。' : 'Booking failed. Please try again.'));
        setSubmitting(false);
        return;
      }

      setBookingSubmittedMessage(t('customerRequestReceived'));
      setStep('done');
    } catch {
      setBookingError(zh ? '預約失敗，請重試。' : 'Booking failed. Please try again.');
    } finally { setSubmitting(false); }
  };

  const handleWaitlistSubmit = async () => {
    if (!business || !selectedService || !selectedTime) return;
    setSubmitting(true);
    setBookingError('');
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: business.id,
          service_id: selectedService.id,
          booking_date: dateStr,
          start_time: selectedTime,
          customer_name: customerName,
          customer_whatsapp: customerPhone,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        if (response.status === 409 && payload.error === 'already_waitlisted') {
          setWaitlistPosition(payload.position ?? 1);
          setStep('done');
          return;
        }
        setBookingError(
          payload.message ||
          (zh ? '加入輪候名單失敗，請重試。' : 'Failed to join waitlist. Please try again.')
        );
        return;
      }

      setWaitlistPosition(payload.entry.position);
      setStep('done');
    } catch {
      setBookingError(
        zh ? '加入輪候名單失敗，請重試。' : 'Failed to join waitlist. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const maxDate = addDays(new Date(), business?.max_advance_days || 30);
  const businessEmoji = business ? getBusinessTypeEmoji(business.type) : '🏪';

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAF8]">
        <div className="text-sm text-[#9CA3AF] animate-pulse uppercase tracking-[0.2em]">
          {t('loading')}
        </div>
      </div>
    );
  }

  // ── Not found ──
  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAF8] px-4">
        <div className="relative bg-white border border-[#E5E7EB] rounded-2xl p-10 text-center max-w-sm overflow-hidden">
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
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#9CA3AF] mb-2">404</p>
            <h2 className="font-display text-2xl font-light text-[#111111]">
              {zh ? '找不到此商戶' : 'Not found'}<span className="text-[#0F766E]">.</span>
            </h2>
            <p className="text-sm text-[#6B7280] mt-2">
              {zh ? '此預約連結可能無效。' : 'This booking link may be invalid.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Done ──
  if (step === 'done') {
    const isWaitlistDone = waitlistPosition !== null;
    const accent = isWaitlistDone ? '#D97706' : '#0F766E';

    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-4 py-10">
        <div className="bg-white border border-[#E5E7EB] rounded-2xl max-w-sm w-full overflow-hidden shadow-sm">
          {/* status edge */}
          <div className="h-1 w-full" style={{ background: accent }} />

          <div className="relative p-7 text-center">
            <div
              aria-hidden
              className="absolute inset-0 opacity-[0.4] pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(#E5E7EB 1px, transparent 1px)',
                backgroundSize: '14px 14px',
                maskImage: 'radial-gradient(circle at top, black, transparent 75%)',
                WebkitMaskImage: 'radial-gradient(circle at top, black, transparent 75%)',
              }}
            />
            <div className="relative">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: `${accent}15` }}
              >
                {isWaitlistDone
                  ? <Users style={{ color: accent }} size={24} />
                  : <Check style={{ color: accent }} size={26} strokeWidth={2.5} />
                }
              </div>

              <p className="text-[10px] uppercase tracking-[0.22em] text-[#9CA3AF] mb-2">
                {isWaitlistDone
                  ? (zh ? '已加入輪候名單' : 'Waitlist · Joined')
                  : (zh ? '預約已送出' : 'Booking · Submitted')}
              </p>
              <h2 className="font-display text-2xl font-light text-[#111111] mb-1">
                {isWaitlistDone
                  ? (zh ? '感謝你' : 'You\'re on the list')
                  : t('bookingConfirmed')}
                <span style={{ color: accent }}>.</span>
              </h2>
              <p className="text-sm text-[#6B7280]">
                {isWaitlistDone
                  ? (zh ? '若有人取消預約，我們會透過 WhatsApp 通知你。' : 'We\'ll WhatsApp you the moment a slot opens.')
                  : t('bookingConfirmedDesc')}
              </p>
            </div>
          </div>

          {isWaitlistDone ? (
            <div className="px-7 pb-2">
              <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: '#FEF3C7', border: '1px solid #FDE68A' }}>
                <Timer size={18} className="mt-0.5 shrink-0" style={{ color: accent }} />
                <div className="text-left">
                  <p className="font-display text-base font-light" style={{ color: '#92400E' }}>
                    {zh
                      ? <>你是第 <span className="tabular-nums font-medium">#{waitlistPosition}</span> 位候補</>
                      : <>You&rsquo;re <span className="tabular-nums font-medium">#{waitlistPosition}</span> on the list</>}
                  </p>
                  <p className="text-[11px] mt-1" style={{ color: '#92400E', opacity: 0.85 }}>
                    {zh
                      ? '有空位時你將收到 WhatsApp 通知，並有 30 分鐘完成預約。'
                      : 'When a spot opens, you\'ll have 30 minutes to confirm.'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="px-7">
              <div
                className="rounded-xl p-3 text-xs flex items-start gap-2"
                style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46' }}
              >
                <Sparkles size={13} className="mt-0.5 shrink-0 text-[#0F766E]" />
                <span>{bookingSubmittedMessage || t('bookingPendingNote')}</span>
              </div>
            </div>
          )}

          {selectedService && (
            <div className="m-7 mt-5 rounded-xl border border-[#E5E7EB] p-4 text-left space-y-2.5">
              {[
                [isWaitlistDone ? (zh ? '服務' : 'Service') : t('service'), zh && selectedService.name_zh ? selectedService.name_zh : selectedService.name],
                [isWaitlistDone ? (zh ? '日期' : 'Date') : t('date'), format(selectedDate, 'MMM d, yyyy')],
                [isWaitlistDone ? (zh ? '時間' : 'Time') : t('time'), formatTime(selectedTime)],
                ...(isWaitlistDone ? [[zh ? '姓名' : 'Name', customerName] as [string, string]] : []),
              ].map(([label, value], i) => (
                <div
                  key={label}
                  className={`flex justify-between text-sm ${i > 0 ? 'pt-2.5 border-t border-dashed border-[#F3F4F6]' : ''}`}
                >
                  <span className="text-[#9CA3AF] text-[12px]">{label}</span>
                  <span className="font-medium text-[#111111]">{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const canProceedFromSelect = Boolean(selectedService && selectedTime);
  const ctaWaitlist = canProceedFromSelect && isWaitlistSlot;

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* ── Top utility bar ── */}
      <div className="bg-[#FAFAF8]/85 backdrop-blur-md sticky top-0 z-20 border-b border-transparent">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-[15px] font-light text-[#111111]">
              BookEasy<span className="text-[#0F766E]">.</span>
            </span>
            <span className="text-[9px] uppercase tracking-[0.22em] text-[#9CA3AF]">
              {zh ? '預約' : 'Book'}
            </span>
          </div>
          <LanguageToggle />
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 pb-32">
        {/* Hero */}
        {business && step === 'select' && (
          <div className="mb-6">
            <HeroCard business={business} zh={zh} collapsed={Boolean(selectedService)} />
          </div>
        )}

        {/* Step rail */}
        <StepRail step={step} zh={zh} />

        {/* ── Step: Select ── */}
        {step === 'select' && (
          <div className="space-y-7 animate-fade-in">
            {/* Services */}
            <section>
              <SectionHead
                step={zh ? '01 · 服務' : '01 · Service'}
                title={t('selectService')}
                action={selectedService ? (
                  <button
                    onClick={() => {
                      setSelectedService(null);
                      setSelectedTime('');
                      setIsWaitlistSlot(false);
                      setQuestionAnswers({});
                    }}
                    className="text-[10px] uppercase tracking-[0.18em] text-[#0F766E] hover:underline cursor-pointer"
                  >
                    {zh ? '更改' : 'Change'}
                  </button>
                ) : null}
              />
              {selectedService ? (
                <SelectedServiceRow
                  service={selectedService}
                  emoji={businessEmoji}
                  zh={zh}
                />
              ) : (
                <ServiceGrid
                  services={services}
                  selected={selectedService}
                  onSelect={(svc) => {
                    setSelectedService(svc);
                    setQuestionAnswers({});
                    setSelectedTime('');
                    setIsWaitlistSlot(false);
                  }}
                  emoji={businessEmoji}
                  zh={zh}
                />
              )}
            </section>

            {/* Date + Time */}
            {selectedService && (
              <section className="animate-fade-up">
                <SectionHead
                  step={zh ? '02 · 日期與時間' : '02 · Date & time'}
                  title={t('selectDateTime')}
                  action={selectedTime ? (
                    <button
                      onClick={() => { setSelectedTime(''); setIsWaitlistSlot(false); }}
                      className="text-[10px] uppercase tracking-[0.18em] text-[#0F766E] hover:underline cursor-pointer"
                    >
                      {zh ? '更改' : 'Change'}
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowFullCalendar((v) => !v)}
                      className="text-[10px] uppercase tracking-[0.18em] text-[#0F766E] hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Calendar size={11} />
                      {showFullCalendar
                        ? (zh ? '收起' : 'Collapse')
                        : (zh ? '更多日期' : 'Calendar')}
                    </button>
                  )}
                />

                {selectedTime ? (
                  <SelectedDateTimeRow
                    date={selectedDate}
                    time={selectedTime}
                    endTime={addMinutesToTime(selectedTime, selectedService.duration_minutes)}
                    isWaitlist={isWaitlistSlot}
                    zh={zh}
                  />
                ) : (
                  <>
                    {showFullCalendar ? (
                      <CalendarPicker
                        selectedDate={selectedDate}
                        onSelect={(d) => {
                          setSelectedDate(d);
                          setSelectedTime('');
                          setIsWaitlistSlot(false);
                          setShowFullCalendar(false);
                        }}
                        maxDate={maxDate}
                        zh={zh}
                      />
                    ) : (
                      <DateStrip
                        selectedDate={selectedDate}
                        onSelect={(d) => {
                          setSelectedDate(d);
                          setSelectedTime('');
                          setIsWaitlistSlot(false);
                        }}
                        maxDate={maxDate}
                        zh={zh}
                      />
                    )}

                    {/* Time slots */}
                    <div className="mt-5">
                      <div className="flex items-baseline justify-between mb-3">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF] font-medium">
                          {format(selectedDate, zh ? 'M月d日 EEEE' : 'EEEE, MMM d')}
                        </p>
                        {availableSlots.length > 0 && (
                          <p className="text-[10px] text-[#9CA3AF] tabular-nums">
                            {availableSlots.filter((s) => s.available).length} {zh ? '個可選' : 'available'}
                          </p>
                        )}
                      </div>

                      {availableSlots.length === 0 ? (
                        <div className="text-center py-10 text-[#9CA3AF] bg-white border border-dashed border-[#E5E7EB] rounded-2xl">
                          <Calendar size={26} className="mx-auto mb-2 opacity-30" />
                          <p className="font-display text-base font-light text-[#111111]">{t('noAvailableSlots')}</p>
                          <p className="text-xs mt-1">{t('selectAnotherDate')}</p>
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-4 gap-2">
                            {availableSlots.map((slot) => {
                              if (slot.available) {
                                return (
                                  <button
                                    key={slot.time}
                                    onClick={() => { setSelectedTime(slot.time); setIsWaitlistSlot(false); }}
                                    className="py-2.5 rounded-xl text-[12px] font-medium tabular-nums transition-all bg-white border border-[#E5E7EB] text-[#3D3D3D] hover:border-[#0F766E] hover:text-[#0F766E] hover:shadow-sm"
                                  >
                                    {formatTime(slot.time)}
                                  </button>
                                );
                              }

                              if (slot.waitlistable) {
                                return (
                                  <button
                                    key={slot.time}
                                    onClick={() => { setSelectedTime(slot.time); setIsWaitlistSlot(true); }}
                                    title={zh ? '此時段已滿，可加入輪候' : 'Slot full — join waitlist'}
                                    className="py-1.5 rounded-xl text-[12px] font-medium tabular-nums transition-all leading-tight bg-amber-50/70 border border-dashed border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400"
                                  >
                                    <span className="block">{formatTime(slot.time)}</span>
                                    <span className="text-[9px] mt-0.5 inline-flex items-center justify-center gap-0.5 uppercase tracking-wider">
                                      <Users size={8} /> {zh ? '輪候' : 'Waitlist'}
                                    </span>
                                  </button>
                                );
                              }

                              return (
                                <button
                                  key={slot.time}
                                  disabled
                                  className="py-2.5 rounded-xl text-[12px] font-medium tabular-nums bg-[#F9FAFB] text-[#D1D5DB] border border-[#F3F4F6] cursor-not-allowed line-through"
                                >
                                  {formatTime(slot.time)}
                                </button>
                              );
                            })}
                          </div>

                          {availableSlots.some((s) => s.waitlistable) && (
                            <p className="mt-3 text-[10px] text-[#9CA3AF] inline-flex items-center gap-1.5">
                              <span className="inline-block w-2 h-2 rounded-full bg-amber-300" />
                              {zh ? '虛線 = 此時段已滿，可加入輪候' : 'Dashed border = fully booked, waitlist available'}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </>
                )}
              </section>
            )}

            {/* WhatsApp reminder banner */}
            {selectedService && selectedTime && (
              <div className="flex items-center gap-3 bg-gradient-to-r from-[#ECFDF5] to-white border border-[#A7F3D0] rounded-2xl px-4 py-3 animate-fade-in">
                <div className="w-9 h-9 rounded-full bg-[#25D366] flex items-center justify-center shrink-0 shadow-sm">
                  <MessageCircle size={16} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#065F46] font-medium">
                    {zh ? 'WhatsApp 自動提醒' : 'Auto reminder'}
                  </p>
                  <p className="text-[12px] text-[#047857] mt-0.5">
                    {zh ? '預約確認後將透過 WhatsApp 提醒你' : 'We\'ll remind you on WhatsApp before your visit.'}
                  </p>
                </div>
              </div>
            )}

            {/* ── Inline details form ── */}
            {selectedService && selectedTime && (
              <section className="animate-fade-up">
                <SectionHead
                  step={zh ? '03 · 你的資料' : '03 · Your details'}
                  title={t('yourDetails')}
                />

                <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 space-y-5">
                  <Input
                    id="customerName"
                    label={t('name')}
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder={zh ? '你的姓名' : 'Your name'}
                    required
                  />

                  <div className="space-y-1.5">
                    <label htmlFor="customerPhone" className="block text-sm font-medium text-[#3D3D3D] inline-flex items-center gap-1.5">
                      <PhoneIcon size={11} className="text-[#9CA3AF]" />
                      WhatsApp
                      {isWaitlistSlot && (
                        <span className="text-amber-600 font-normal text-[10px] uppercase tracking-wider">
                          ({zh ? '通知用' : 'for notifications'})
                        </span>
                      )}
                    </label>
                    <Input
                      id="customerPhone"
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="+852 9XXX XXXX"
                      required
                    />
                  </div>

                  {!isWaitlistSlot && (
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-[#3D3D3D]">
                        {t('notes')} <span className="text-[#9CA3AF] font-normal text-[10px] uppercase tracking-wider ml-1">({t('optional')})</span>
                      </label>
                      <textarea
                        value={customerNotes}
                        onChange={(e) => setCustomerNotes(e.target.value)}
                        placeholder={t('notesPlaceholder')}
                        rows={2}
                        className="w-full px-3.5 py-2.5 text-sm border border-[#E5E7EB] rounded-lg bg-white text-[#111111] placeholder:text-[#D1D5DB] focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] resize-none"
                      />
                    </div>
                  )}

                  {!isWaitlistSlot && selectedService?.allow_customer_image && (
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-[#3D3D3D]">
                        {zh ? '上傳參考圖片' : 'Reference photo'}
                        <span className="text-[#9CA3AF] font-normal text-[10px] uppercase tracking-wider ml-1">({t('optional')})</span>
                      </label>
                      {customerImageUrl ? (
                        <div className="relative w-full rounded-xl border border-[#E5E7EB] p-1.5 bg-white">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={customerImageUrl}
                            alt={zh ? '已上傳圖片' : 'Uploaded image'}
                            className="w-full h-44 object-cover rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => setCustomerImageUrl('')}
                            className="absolute top-2.5 right-2.5 bg-white border border-[#E5E7EB] rounded-full p-1.5 hover:bg-red-50 text-[#6B7280] hover:text-red-500 transition-colors shadow-sm"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-[#E5E7EB] rounded-xl cursor-pointer hover:border-[#0F766E] hover:bg-[#0F766E]/[0.03] transition-colors">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleImageUpload(file);
                            }}
                          />
                          {imageUploading ? (
                            <div className="flex flex-col items-center gap-2 text-[#6B7280]">
                              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              <span className="text-xs">{zh ? '上傳中...' : 'Uploading…'}</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1.5 text-[#9CA3AF]">
                              <ImagePlus size={22} />
                              <span className="text-xs font-medium text-[#6B7280]">
                                {zh ? '點擊選擇圖片' : 'Tap to add a photo'}
                              </span>
                              <span className="text-[10px]">{zh ? 'JPG、PNG，最大 10MB' : 'JPG / PNG up to 10 MB'}</span>
                            </div>
                          )}
                        </label>
                      )}
                      {imageUploadError && (
                        <p className="text-xs text-red-500">{imageUploadError}</p>
                      )}
                    </div>
                  )}

                  {!isWaitlistSlot && visibleQuestions.length > 0 && (
                    <div className="rounded-xl border border-[#E5E7EB] bg-[#FAFAF8] p-4 space-y-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF] font-medium mb-1">
                          {zh ? '預約小問題' : 'Quick questions'}
                        </p>
                        <p className="text-[11px] text-[#6B7280]">
                          {zh ? '幫商戶提前準備，更快完成預約。' : 'A few quick answers help the business prepare.'}
                        </p>
                      </div>

                      <div className="space-y-4">
                        {visibleQuestions.map((question, qi) => (
                          <div
                            key={question.id}
                            className={`space-y-2 ${qi > 0 ? 'pt-3 border-t border-dashed border-[#E5E7EB]' : ''}`}
                          >
                            <label className="flex items-baseline gap-2 text-sm font-medium text-[#3D3D3D]">
                              <span className="font-display text-[12px] font-light text-[#9CA3AF] tabular-nums shrink-0">
                                {(qi + 1).toString().padStart(2, '0')}
                              </span>
                              <span className="flex-1">
                                {question.question_text}
                                {question.is_required && <span className="text-[#D97706] ml-1">*</span>}
                              </span>
                            </label>

                            {question.input_type === 'text' && (
                              <textarea
                                value={questionAnswers[question.id] || ''}
                                onChange={(event) => updateQuestionAnswer(question.id, event.target.value)}
                                rows={2}
                                placeholder={zh ? '可填寫任何補充內容' : 'Add any helpful detail'}
                                className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-sm text-[#111111] placeholder:text-[#D1D5DB] focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] resize-y"
                              />
                            )}

                            {question.input_type === 'select' && (
                              <select
                                value={questionAnswers[question.id] || ''}
                                onChange={(event) => updateQuestionAnswer(question.id, event.target.value)}
                                className="w-full h-10 px-3 rounded-lg border border-[#E5E7EB] bg-white text-[#3D3D3D] text-sm transition-colors appearance-none focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]"
                              >
                                <option value="">{zh ? '請選擇' : 'Please select'}</option>
                                {(question.options || []).map((option) => (
                                  <option key={option} value={option}>{option}</option>
                                ))}
                              </select>
                            )}

                            {question.input_type === 'yes-no' && (
                              <div className="flex gap-2">
                                {[
                                  { value: 'Yes', label: zh ? '是' : 'Yes' },
                                  { value: 'No', label: zh ? '否' : 'No' },
                                ].map((option) => {
                                  const isSelected = questionAnswers[question.id] === option.value;
                                  return (
                                    <button
                                      key={option.value}
                                      type="button"
                                      onClick={() => updateQuestionAnswer(question.id, option.value)}
                                      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                                        isSelected
                                          ? 'border-[#0F766E] bg-[#0F766E]/[0.06] text-[#0F766E]'
                                          : 'border-[#E5E7EB] bg-white text-[#3D3D3D] hover:border-[#0F766E]/50'
                                      }`}
                                    >
                                      {option.label}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="rounded-lg border border-dashed border-[#E5E7EB] px-4 py-3 bg-[#FAFAF8]">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[#9CA3AF] font-medium mb-1">
                      {t('pdpoNotice')}
                    </p>
                    <p className="text-[11px] text-[#6B7280] leading-snug">{t('pdpoText')}</p>
                  </div>
                </div>

                {!isWaitlistSlot && missingRequiredQuestion && (
                  <p className="mt-3 text-xs text-red-500">
                    {zh ? '請先完成所有必填問題。' : 'Please complete all required questions before continuing.'}
                  </p>
                )}
              </section>
            )}
          </div>
        )}

        {/* ── Step: Confirm ── */}
        {step === 'confirm' && selectedService && (
          <div className="animate-fade-in space-y-5">
            <button
              onClick={() => setStep('select')}
              className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-[#6B7280] hover:text-[#111111] transition-colors cursor-pointer"
            >
              <ChevronLeft size={12} /> {t('back')}
            </button>

            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF] font-medium mb-1">
                {isWaitlistSlot
                  ? (zh ? '輪候名單' : 'Waitlist')
                  : (zh ? '請確認' : 'Almost there')}
              </p>
              <h2 className="font-display text-[22px] font-light text-[#111111] leading-tight">
                {isWaitlistSlot
                  ? (zh ? '確認加入輪候名單' : 'Confirm waitlist')
                  : t('bookingSummary')}
                <span className="text-[#0F766E]">.</span>
              </h2>
            </div>

            {isWaitlistSlot && (
              <div
                className="flex items-start gap-2.5 rounded-2xl px-4 py-3 text-xs"
                style={{ background: '#FEF3C7', border: '1px solid #FDE68A', color: '#92400E' }}
              >
                <Users size={14} className="shrink-0 mt-0.5 text-amber-700" />
                <p>
                  {zh
                    ? '此時段已滿。確認後你將加入輪候名單，並透過 WhatsApp 收到通知。'
                    : 'This slot is fully booked. Confirm to join the waitlist — we\'ll WhatsApp you if a spot opens.'}
                </p>
              </div>
            )}

            {/* Hero summary card */}
            <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden">
              <div className="h-1" style={{ background: isWaitlistSlot ? '#D97706' : '#0F766E' }} />
              <div className="p-5">
                <div className="flex items-end gap-5 pb-4 border-b border-dashed border-[#E5E7EB]">
                  <div className="text-center shrink-0">
                    <p className="font-display text-[44px] leading-none font-light text-[#111111] tabular-nums">
                      {format(selectedDate, 'd')}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-[#9CA3AF] mt-1">
                      {format(selectedDate, zh ? 'M月' : 'MMM')}
                    </p>
                  </div>
                  <div className="h-12 w-px bg-[#E5E7EB]" />
                  <div className="min-w-0 pb-1">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[#9CA3AF] mb-1">
                      {format(selectedDate, 'EEEE')}
                    </p>
                    <p className="font-display text-[18px] font-light text-[#111111] leading-tight tabular-nums">
                      {formatTime(selectedTime)}
                    </p>
                    <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                      {selectedService.duration_minutes}{zh ? '分鐘' : ' min'}
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5 mt-4">
                  {[
                    [t('service'), zh && selectedService.name_zh ? selectedService.name_zh : selectedService.name],
                    ...(!isWaitlistSlot && selectedService.pricing_type === 'tbc'
                      ? [[t('price'), zh ? '待確認（確認預約時告知）' : 'TBC (set on confirm)']]
                      : selectedService.price_hkd && !isWaitlistSlot
                        ? [[t('price'), formatPrice(selectedService.price_hkd)]]
                        : []),
                  ].map(([label, value], i) => (
                    <div
                      key={label}
                      className={`flex justify-between text-sm ${i > 0 ? 'pt-2.5 border-t border-dashed border-[#F3F4F6]' : ''}`}
                    >
                      <span className="text-[#9CA3AF] text-[12px]">{label}</span>
                      <span className="font-medium text-[#111111] text-right">{value}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-dashed border-[#E5E7EB] space-y-2.5">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF] font-medium mb-1">
                    {zh ? '你的資料' : 'You'}
                  </p>
                  {[
                    [t('name'), customerName],
                    ['WhatsApp', customerPhone],
                    ...(!isWaitlistSlot
                      ? visibleQuestions
                          .filter((q) => questionAnswers[q.id]?.trim())
                          .map((q) => [q.question_text, questionAnswers[q.id]] as [string, string])
                      : []),
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-3 text-sm">
                      <span className="text-[#9CA3AF] text-[12px] shrink-0">{label}</span>
                      <span className="font-medium text-[#111111] text-right max-w-[60%] whitespace-pre-wrap">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {bookingError && (
                <div className="mx-5 mb-5 px-3.5 py-2.5 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">
                  {bookingError}
                </div>
              )}
            </div>

            {/* Business contact card */}
            {business && (business.address_text || business.address_map_link || business.phone) && (
              <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 space-y-2.5">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF] font-medium">
                  {zh ? '商戶資料' : 'Business'}
                </p>
                {business.address_map_link && (
                  <a
                    href={business.address_map_link}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-xs text-[#0F766E] hover:underline"
                  >
                    <MapPin size={12} className="shrink-0" />
                    <span>{zh ? '查看 Google 地圖' : 'Open in Google Maps'}</span>
                    <ExternalLink size={11} />
                  </a>
                )}
                {business.address_text && (
                  <div className="flex items-start gap-2 text-xs text-[#3D3D3D]">
                    <MapPin size={12} className="mt-0.5 text-[#0F766E] shrink-0" />
                    <span>{business.address_text}</span>
                  </div>
                )}
                {business.phone && (
                  <div className="flex items-center gap-2 text-xs text-[#3D3D3D]">
                    <PhoneIcon size={12} className="text-[#0F766E] shrink-0" />
                    <span>{business.phone}</span>
                  </div>
                )}
                {(() => {
                  const socialLinks = parseBusinessSocialLinks(business.social_links);
                  const socialEntries = Object.entries(socialLinks).filter(([, url]) => Boolean(url));
                  if (socialEntries.length === 0) return null;
                  return (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {socialEntries.map(([platform, url]) => (
                        <a
                          key={platform}
                          href={url as string}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-full border border-[#E5E7EB] bg-white px-2.5 py-1 text-[10px] uppercase tracking-wider text-[#0F766E] hover:bg-[#0F766E]/5 hover:border-[#0F766E]/30 transition-colors"
                        >
                          {SOCIAL_LABELS[platform as keyof typeof SOCIAL_LABELS]}
                          <ExternalLink size={9} />
                        </a>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Sticky bottom CTA ── */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#E5E7EB] bg-white/95 backdrop-blur-md">
        <div className="max-w-md mx-auto px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {step === 'select' && (
            <>
              {selectedService && selectedTime && (
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-[11px] text-[#9CA3AF] truncate inline-flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-[#0F766E]" />
                    {zh && selectedService.name_zh ? selectedService.name_zh : selectedService.name}
                    <span className="text-[#D1D5DB]">·</span>
                    {format(selectedDate, zh ? 'M月d日' : 'MMM d')}
                    <span className="text-[#D1D5DB]">·</span>
                    {formatTime(selectedTime)}
                  </span>
                  {selectedService.price_hkd && !isWaitlistSlot && (
                    <span className="font-display text-[14px] font-light text-[#111111] shrink-0 ml-2 tabular-nums">
                      {formatPrice(selectedService.price_hkd)}
                    </span>
                  )}
                </div>
              )}
              <button
                disabled={!canProceedFromSelect || !customerName.trim() || !customerPhone.trim() || Boolean(!isWaitlistSlot && missingRequiredQuestion)}
                onClick={() => setStep('confirm')}
                className={`w-full py-3.5 rounded-2xl text-[14px] font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${
                  ctaWaitlist
                    ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm hover:shadow'
                    : 'bg-[#0F766E] hover:bg-[#0D9488] text-white shadow-sm hover:shadow'
                }`}
              >
                {ctaWaitlist ? (
                  <><Users size={15} />{zh ? '加入輪候名單' : 'Join Waitlist'}</>
                ) : (
                  <>{t('bookNow')}<ArrowRight size={15} /></>
                )}
              </button>
              <div className="mt-2 flex items-center justify-center gap-1.5 text-[9px] uppercase tracking-[0.18em] text-[#9CA3AF]">
                <ShieldCheck size={11} className="text-[#0F766E]" />
                <span>{zh ? '安全預約' : 'Secure booking'}</span>
              </div>
            </>
          )}

          {step === 'confirm' && (
            <button
              onClick={isWaitlistSlot ? handleWaitlistSubmit : handleSubmit}
              disabled={submitting}
              className={`w-full py-3.5 rounded-2xl text-[14px] font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-60 ${
                isWaitlistSlot
                  ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm hover:shadow'
                  : 'bg-[#0F766E] hover:bg-[#0D9488] text-white shadow-sm hover:shadow'
              }`}
            >
              {submitting ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {isWaitlistSlot ? (zh ? '加入中⋯' : 'Joining…') : (zh ? '確認中⋯' : 'Confirming…')}
                </>
              ) : isWaitlistSlot ? (
                <><Users size={15} />{zh ? '加入輪候名單' : 'Join Waitlist'}</>
              ) : (
                <>{t('confirmBooking')}<ArrowRight size={15} /></>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BookingPage() {
  return (
    <I18nProvider>
      <BookingFlow />
    </I18nProvider>
  );
}
