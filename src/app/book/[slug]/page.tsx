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
} from 'lucide-react';

type BookingStep = 'select' | 'confirm' | 'done';

/** Extends TimeSlot with a waitlistable flag.
 * waitlistable = true  → slot is fully booked but NOT blocked by the business,
 *                        so the customer may join the waitlist.
 * waitlistable = false → slot is blocked by the business or during break;
 *                        no waitlist option shown.
 */
type SlotInfo = { time: string; available: boolean; waitlistable: boolean };

const STEP_LABELS_ZH = ['填寫預約', '確認'];
const STEP_LABELS_EN = ['Booking', 'Confirm'];

const SOCIAL_LABELS = {
  instagram: 'Instagram',
  threads: 'Threads',
  facebook: 'Facebook',
  other: 'Link',
} as const;

// Soft gradient palette for service tile headers (rotates by index).
const TILE_GRADIENTS = [
  'bg-gradient-to-br from-[#CCFBF1] to-[#5EEAD4]',
  'bg-gradient-to-br from-[#FCE7F3] to-[#F9A8D4]',
  'bg-gradient-to-br from-[#FEF3C7] to-[#FCD34D]',
  'bg-gradient-to-br from-[#DBEAFE] to-[#93C5FD]',
  'bg-gradient-to-br from-[#EDE9FE] to-[#C4B5FD]',
  'bg-gradient-to-br from-[#FFEDD5] to-[#FDBA74]',
];

// ── Step indicator (3 steps) ────────────────────────────────────────────────
function StepIndicator({ step, zh }: { step: BookingStep; zh: boolean }) {
  const STEPS: BookingStep[] = ['select', 'confirm'];
  const currentIdx = STEPS.indexOf(step);
  const labels = zh ? STEP_LABELS_ZH : STEP_LABELS_EN;

  return (
    <div className="flex items-center gap-0 mb-5">
      {STEPS.map((s, i) => {
        const isCompleted = currentIdx > i;
        const isActive = currentIdx === i;
        return (
          <div key={s} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold border-2 transition-colors ${
                  isCompleted
                    ? 'bg-[#0F766E] border-[#0F766E] text-white'
                    : isActive
                    ? 'bg-white border-[#0F766E] text-[#0F766E]'
                    : 'bg-white border-[#E5E7EB] text-[#9CA3AF]'
                }`}
              >
                {isCompleted ? <Check size={12} /> : i + 1}
              </div>
              <span className={`text-[10px] whitespace-nowrap ${isActive ? 'text-[#0F766E] font-medium' : 'text-[#9CA3AF]'}`}>
                {labels[i]}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-1 mb-4 transition-colors ${currentIdx > i ? 'bg-[#0F766E]' : 'bg-[#E5E7EB]'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Hero + business identity card ───────────────────────────────────────────
function HeroCard({ business, zh, collapsed }: { business: Business; zh: boolean; collapsed: boolean }) {
  const emoji = getBusinessTypeEmoji(business.type);
  return (
    <div className="relative">
      {/* Banner — collapses when a service is picked */}
      <div
        className={`rounded-2xl overflow-hidden bg-[#F3F4F6] shadow-card transition-all duration-300 ease-out ${
          collapsed ? 'aspect-[16/3] opacity-80' : 'aspect-[16/9]'
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
      </div>

      {/* Identity card overlap */}
      <div className="-mt-8 mx-3 bg-white rounded-2xl border border-[#E5E7EB] shadow-card p-3.5 flex items-center gap-3 relative">
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
          <h1 className="text-[15px] font-semibold text-[#111111] leading-tight truncate">
            {business.name}
          </h1>
          {(business.district || business.address_text) && (
            <div className="flex items-center gap-1 text-xs text-[#6B7280] mt-0.5 truncate">
              <MapPin size={11} className="text-[#0F766E] shrink-0" />
              <span className="truncate">{business.district || business.address_text}</span>
            </div>
          )}
          {zh && business.name && (
            <p className="text-[11px] text-[#9CA3AF] mt-0.5 truncate">
              {/* Subtle subtitle line — phone or business type */}
              {business.phone || (zh ? '歡迎預約' : 'Welcome — book a visit')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Service grid (2-col tiles) ──────────────────────────────────────────────
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
      {services.map((svc, i) => {
        const isSelected = selected?.id === svc.id;
        const gradient = TILE_GRADIENTS[i % TILE_GRADIENTS.length];
        return (
          <button
            key={svc.id}
            onClick={() => onSelect(svc)}
            className={`text-left bg-white rounded-2xl overflow-hidden border-2 transition-all cursor-pointer ${
              isSelected
                ? 'border-[#0F766E] shadow-card ring-2 ring-[#0F766E]/10'
                : 'border-[#E5E7EB] hover:border-[#0F766E]/40'
            }`}
          >
            {/* Tile header */}
            <div className={`relative aspect-[5/4] ${svc.image_url ? 'bg-[#F3F4F6]' : gradient} flex items-center justify-center overflow-hidden`}>
              {svc.image_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={svc.image_url}
                  alt={svc.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-3xl drop-shadow-sm" aria-hidden>
                  {emoji}
                </span>
              )}
              {isSelected && (
                <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#0F766E] text-white flex items-center justify-center shadow-sm">
                  <Check size={13} strokeWidth={3} />
                </div>
              )}
            </div>
            {/* Body */}
            <div className="p-3">
              <p className="text-[13px] font-semibold text-[#111111] leading-tight line-clamp-1">
                {svc.name}
              </p>
              {svc.name_zh && (
                <p className="text-[11px] text-[#6B7280] mt-0.5 line-clamp-1">{svc.name_zh}</p>
              )}
              <div className="flex items-center justify-between mt-1.5">
                {svc.pricing_type === 'tbc' ? (
                  <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                    {zh ? '待確認' : 'TBC'}
                  </span>
                ) : svc.price_hkd ? (
                  <span className="text-[13px] font-bold text-[#0F766E]">
                    {formatPrice(svc.price_hkd)}
                  </span>
                ) : (
                  <span />
                )}
                <span className="text-[10px] text-[#9CA3AF] flex items-center gap-0.5">
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

// ── Selected service row (compact) ─────────────────────────────────────────
function SelectedServiceRow({
  service,
  index,
  emoji,
  zh,
}: {
  service: Service;
  index: number;
  emoji: string;
  zh: boolean;
}) {
  const gradient = TILE_GRADIENTS[index % TILE_GRADIENTS.length];
  return (
    <div className="bg-white rounded-2xl overflow-hidden border-2 border-[#0F766E] shadow-card ring-2 ring-[#0F766E]/10 flex items-center gap-3 p-2.5">
      <div className={`relative w-14 h-14 rounded-xl ${service.image_url ? 'bg-[#F3F4F6]' : gradient} flex items-center justify-center shrink-0 overflow-hidden`}>
        {service.image_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={service.image_url} alt={service.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-2xl drop-shadow-sm" aria-hidden>{emoji}</span>
        )}
        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#0F766E] text-white flex items-center justify-center shadow-sm">
          <Check size={11} strokeWidth={3} />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-[#111111] leading-tight truncate">
          {service.name}
        </p>
        {service.name_zh && (
          <p className="text-[11px] text-[#6B7280] mt-0.5 truncate">{service.name_zh}</p>
        )}
        <span className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] text-[#9CA3AF]">
          <Clock size={9} /> {service.duration_minutes}{zh ? '分' : 'm'}
        </span>
      </div>
      <div className="shrink-0 pr-1">
        {service.pricing_type === 'tbc' ? (
          <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
            {zh ? '待確認' : 'TBC'}
          </span>
        ) : service.price_hkd ? (
          <span className="text-[14px] font-bold text-[#0F766E]">
            {formatPrice(service.price_hkd)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ── Selected date/time row (compact) ───────────────────────────────────────
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
  const accent = isWaitlist
    ? 'border-amber-400 ring-2 ring-amber-200'
    : 'border-[#0F766E] ring-2 ring-[#0F766E]/10';
  const tile = isWaitlist
    ? 'bg-gradient-to-br from-amber-100 to-amber-200'
    : 'bg-gradient-to-br from-[#CCFBF1] to-[#5EEAD4]';
  const checkBg = isWaitlist ? 'bg-amber-500' : 'bg-[#0F766E]';

  return (
    <div className={`bg-white rounded-2xl overflow-hidden border-2 ${accent} shadow-card flex items-center gap-3 p-2.5`}>
      <div className={`relative w-14 h-14 rounded-xl ${tile} flex flex-col items-center justify-center shrink-0`}>
        <span className="text-[9px] font-medium uppercase text-[#0F766E]/80 leading-none">
          {format(date, zh ? 'EEE' : 'EEE')}
        </span>
        <span className="text-lg font-bold text-[#0F766E] leading-none mt-0.5">
          {format(date, 'd')}
        </span>
        <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full ${checkBg} text-white flex items-center justify-center shadow-sm`}>
          <Check size={11} strokeWidth={3} />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-[#111111] leading-tight truncate">
          {format(date, zh ? 'M月d日（EEEE）' : 'EEEE, MMM d')}
        </p>
        <p className="text-[11px] text-[#6B7280] mt-0.5 truncate">
          {formatTime(time)}{endTime ? ` – ${formatTime(endTime)}` : ''}
        </p>
        {isWaitlist && (
          <span className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-700">
            <Users size={9} /> {zh ? '輪候' : 'Waitlist'}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Date strip (horizontal scroll) ──────────────────────────────────────────
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

  // Show next 14 days from today (cap at maxDate).
  const days = useMemo(() => {
    const out: Date[] = [];
    for (let i = 0; i < 14; i++) {
      const d = addDays(today, i);
      if (isBefore(maxDate, d)) break;
      out.push(d);
    }
    return out;
  }, [today, maxDate]);

  // Auto-scroll selected day into view.
  const scrollerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollerRef.current?.querySelector<HTMLButtonElement>('[data-selected="true"]');
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [selectedDate]);

  return (
    <div
      ref={scrollerRef}
      className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory scroll-smooth"
      style={{ scrollbarWidth: 'none' }}
    >
      {days.map((day) => {
        const isSelected = isSameDay(day, selectedDate);
        const todayDay = isToday(day);
        return (
          <button
            key={day.toISOString()}
            data-selected={isSelected}
            onClick={() => onSelect(day)}
            className={`shrink-0 snap-start w-14 py-2.5 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-colors border ${
              isSelected
                ? 'bg-[#0F766E] border-[#0F766E] text-white shadow-card'
                : 'bg-white border-[#E5E7EB] text-[#3D3D3D] hover:border-[#0F766E]/40'
            }`}
          >
            <span className={`text-[10px] font-medium uppercase ${isSelected ? 'text-white/85' : 'text-[#9CA3AF]'}`}>
              {labels[getDay(day)]}
            </span>
            <span className="text-base font-semibold leading-none">{format(day, 'd')}</span>
            <span className={`mt-1 w-1.5 h-1.5 rounded-full ${
              todayDay
                ? isSelected ? 'bg-white' : 'bg-[#0F766E]'
                : 'bg-transparent'
            }`} />
          </button>
        );
      })}
    </div>
  );
}

// ── Full calendar (collapsed/expanded) ──────────────────────────────────────
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
    : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = getDay(monthStart);
  const allCells = [...Array(startPad).fill(null), ...days];

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-2xl p-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#111111]">
          {format(viewMonth, zh ? 'yyyy年 M月' : 'MMMM yyyy')}
        </h3>
        <div className="flex gap-1">
          <button
            onClick={() => setViewMonth(subMonths(viewMonth, 1))}
            disabled={isBefore(endOfMonth(subMonths(viewMonth, 1)), today)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#6B7280] hover:bg-[#F3F4F6] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => setViewMonth(addMonths(viewMonth, 1))}
            disabled={isBefore(maxDate, startOfMonth(addMonths(viewMonth, 1)))}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#6B7280] hover:bg-[#F3F4F6] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {dayLabels.map((d) => (
          <div key={d} className="text-center text-[11px] font-medium text-[#9CA3AF] py-0.5">
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
              className={`h-9 flex items-center justify-center text-sm rounded-lg font-medium transition-colors ${
                isSelected
                  ? 'bg-[#0F766E] text-white'
                  : todayDay && !disabled
                  ? 'border-2 border-[#0F766E] text-[#0F766E]'
                  : disabled
                  ? 'text-[#D1D5DB] cursor-not-allowed'
                  : 'text-[#3D3D3D] hover:bg-[#CCFBF1] hover:text-[#0F766E]'
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

  // ── Waitlist state ─────────────────────────────────────────────────────────
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
    const { data: biz } = await supabase.from('businesses').select('*').eq('slug', slug).eq('onboarding_complete', true).single();
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

    // ── Pre-fill slot from WhatsApp waitlist notification link ─────────────
    // Link format: /book/[slug]?date=YYYY-MM-DD&time=HH:MM&service=UUID&wt=WAITLIST_ID
    if (typeof window !== 'undefined' && svc) {
      const urlParams = new URLSearchParams(window.location.search);
      const pDate    = urlParams.get('date');
      const pTime    = urlParams.get('time');
      const pService = urlParams.get('service');

      if (pDate && pTime && pService) {
        const prefillService = svc.find((s) => s.id === pService);
        if (prefillService) {
          const prefillDate = new Date(`${pDate}T12:00:00`);
          setSelectedService(prefillService);
          setSelectedDate(prefillDate);
          setSelectedTime(pTime);
          // Stay on 'select' — the form is now inline beneath the date/time row.
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
    if (!dayHours || !dayHours.is_open || !dayHours.open_time || !dayHours.close_time) { setAvailableSlots([]); return; }
    const slots: SlotInfo[] = [];
    const openMin = timeToMinutes(dayHours.open_time);
    const closeMin = timeToMinutes(dayHours.close_time);
    const breakStartMin = dayHours.break_start ? timeToMinutes(dayHours.break_start) : null;
    const breakEndMin = dayHours.break_end ? timeToMinutes(dayHours.break_end) : null;
    const duration = selectedService.duration_minutes;
    const buffer = business.buffer_minutes || 0;
    const nowMin = isToday(date) ? new Date().getHours() * 60 + new Date().getMinutes() + (business.min_advance_hours * 60) : 0;
    for (let startMin = openMin; startMin + duration <= closeMin; startMin += 30) {
      const endMin = startMin + duration;
      const slotTime = `${String(Math.floor(startMin / 60)).padStart(2, '0')}:${String(startMin % 60).padStart(2, '0')}`;
      if (startMin < nowMin) continue;
      const inBreak = breakStartMin !== null && breakEndMin !== null && startMin < breakEndMin && endMin > breakStartMin;
      if (inBreak) continue;
      const hasConflict = (bookings || []).some((b) => { const bStart = timeToMinutes(b.start_time); const bEnd = timeToMinutes(b.end_time) + buffer; return startMin < bEnd && endMin > bStart; });
      const isBlocked  = (blocked  || []).some((b) => { const bStart = timeToMinutes(b.start_time); const bEnd = timeToMinutes(b.end_time); return startMin < bEnd && endMin > bStart; });
      slots.push({
        time: slotTime,
        available: !hasConflict && !isBlocked,
        waitlistable: hasConflict && !isBlocked,
      });
    }
    setAvailableSlots(slots);
  }, [business, selectedService, hours]);

  // Load slots whenever the user has both a service and a date in 'select' step.
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
        <div className="text-sm text-[#6B7280] animate-pulse">{t('loading')}</div>
      </div>
    );
  }

  // ── Not found ──
  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAF8] px-4">
        <div className="text-center max-w-sm bg-white border border-[#E5E7EB] rounded-2xl p-8">
          <p className="text-4xl mb-4">🔍</p>
          <h2 className="text-lg font-semibold text-[#111111] mb-2">{zh ? '找不到此商戶' : 'Business not found'}</h2>
          <p className="text-sm text-[#6B7280]">{zh ? '此預約連結可能無效。' : 'This booking link may be invalid.'}</p>
        </div>
      </div>
    );
  }

  // ── Done ──
  if (step === 'done') {
    const isWaitlistDone = waitlistPosition !== null;

    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-4">
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-8 text-center max-w-sm w-full shadow-card">

          <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${isWaitlistDone ? 'bg-amber-50' : 'bg-[#D1FAE5]'}`}>
            {isWaitlistDone
              ? <Users className="text-amber-600" size={24} />
              : <Check className="text-[#065F46]" size={24} />
            }
          </div>

          {isWaitlistDone ? (
            <>
              <h2 className="text-xl font-semibold text-[#111111] mb-1">
                {zh ? '已加入輪候名單！' : 'Added to Waitlist!'}
              </h2>
              <p className="text-sm text-[#6B7280] mb-4">
                {zh
                  ? '若有人取消預約，我們將透過 WhatsApp 通知你。'
                  : 'If a cancellation occurs, we\'ll notify you via WhatsApp.'}
              </p>

              <div className="flex items-center justify-center gap-2 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-4 mb-6">
                <Timer size={20} className="text-amber-600 shrink-0" />
                <div className="text-left">
                  <p className="text-base font-bold text-amber-700">
                    {zh
                      ? `你是第 #${waitlistPosition} 位候補`
                      : `You're #${waitlistPosition} on the waitlist`}
                  </p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    {zh
                      ? '有空位時你將收到 WhatsApp 通知，並有 30 分鐘完成預約。'
                      : 'You\'ll get a WhatsApp alert when a slot opens. You\'ll have 30 minutes to book.'}
                  </p>
                </div>
              </div>

              {selectedService && (
                <div className="bg-[#F9FAFB] rounded-xl p-4 mb-2 text-left space-y-2.5">
                  {[
                    [zh ? '服務' : 'Service', zh && selectedService.name_zh ? selectedService.name_zh : selectedService.name],
                    [zh ? '日期' : 'Date', format(selectedDate, 'MMM d, yyyy')],
                    [zh ? '時間' : 'Time', formatTime(selectedTime)],
                    [zh ? '姓名' : 'Name', customerName],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between text-sm">
                      <span className="text-[#6B7280]">{label}</span>
                      <span className="font-medium text-[#111111]">{value}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-[#111111] mb-1">{t('bookingConfirmed')}</h2>
              <p className="text-sm text-[#6B7280] mb-6">{t('bookingConfirmedDesc')}</p>
              <p className="text-xs text-[#0F766E] bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl px-3 py-2 mb-6">
                {bookingSubmittedMessage || t('bookingPendingNote')}
              </p>
              {selectedService && (
                <div className="bg-[#F9FAFB] rounded-xl p-4 mb-6 text-left space-y-2.5">
                  {[
                    [t('service'), zh && selectedService.name_zh ? selectedService.name_zh : selectedService.name],
                    [t('date'), format(selectedDate, 'MMM d, yyyy')],
                    [t('time'), formatTime(selectedTime)],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between text-sm">
                      <span className="text-[#6B7280]">{label}</span>
                      <span className="font-medium text-[#111111]">{value}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // Selection complete → enable Book Now CTA
  const canProceedFromSelect = Boolean(selectedService && selectedTime);
  const ctaWaitlist = canProceedFromSelect && isWaitlistSlot;

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* ── Top utility bar (slim) ── */}
      <div className="bg-[#FAFAF8] sticky top-0 z-20 backdrop-blur-sm bg-opacity-90">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-wide">
            {zh ? '預約' : 'Booking'}
          </div>
          <LanguageToggle />
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 pb-32">
        {/* Hero + business identity */}
        {business && step === 'select' && (
          <div className="mb-5">
            <HeroCard business={business} zh={zh} collapsed={Boolean(selectedService)} />
          </div>
        )}

        {/* Step indicator */}
        <StepIndicator step={step} zh={zh} />

        {/* ── Step: Select (services + date + time) ── */}
        {step === 'select' && (
          <div className="space-y-6 animate-fade-in">
            {/* Services */}
            <section>
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-[15px] font-semibold text-[#111111]">
                  {t('selectService')}
                </h2>
                {selectedService ? (
                  <button
                    onClick={() => {
                      setSelectedService(null);
                      setSelectedTime('');
                      setIsWaitlistSlot(false);
                      setQuestionAnswers({});
                    }}
                    className="text-[11px] font-medium text-[#0F766E] hover:underline"
                  >
                    {zh ? '重新選擇' : 'Reselect service'}
                  </button>
                ) : zh ? (
                  <span className="text-[11px] text-[#9CA3AF]">選擇服務</span>
                ) : null}
              </div>
              {selectedService ? (
                <SelectedServiceRow
                  service={selectedService}
                  index={services.findIndex((s) => s.id === selectedService.id)}
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

            {/* Date + Time (revealed once a service is picked) */}
            {selectedService && (
              <section className="animate-fade-up">
                <div className="flex items-baseline justify-between mb-3">
                  <h2 className="text-[15px] font-semibold text-[#111111]">
                    {t('selectDateTime')}
                  </h2>
                  {selectedTime ? (
                    <button
                      onClick={() => { setSelectedTime(''); setIsWaitlistSlot(false); }}
                      className="text-[11px] font-medium text-[#0F766E] hover:underline"
                    >
                      {zh ? '重新選擇' : 'Reselect time'}
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowFullCalendar((v) => !v)}
                      className="text-[11px] font-medium text-[#0F766E] hover:underline flex items-center gap-1"
                    >
                      <Calendar size={11} />
                      {showFullCalendar
                        ? (zh ? '收起' : 'Collapse')
                        : (zh ? '更多日期' : 'More dates')}
                    </button>
                  )}
                </div>

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
                        onSelect={(d) => { setSelectedDate(d); setSelectedTime(''); setIsWaitlistSlot(false); setShowFullCalendar(false); }}
                        maxDate={maxDate}
                        zh={zh}
                      />
                    ) : (
                      <DateStrip
                        selectedDate={selectedDate}
                        onSelect={(d) => { setSelectedDate(d); setSelectedTime(''); setIsWaitlistSlot(false); }}
                        maxDate={maxDate}
                        zh={zh}
                      />
                    )}

                    {/* Time slots */}
                    <div className="mt-4">
                      <p className="text-[11px] font-medium text-[#6B7280] uppercase tracking-wide mb-2">
                        {format(selectedDate, zh ? 'M月d日（EEE）' : 'EEE, MMM d')}
                      </p>
                      {availableSlots.length === 0 ? (
                        <div className="text-center py-8 text-[#6B7280] bg-white border border-[#E5E7EB] rounded-2xl">
                          <Calendar size={24} className="mx-auto mb-2 opacity-40" />
                          <p className="text-sm">{t('noAvailableSlots')}</p>
                          <p className="text-xs mt-1 opacity-70">{t('selectAnotherDate')}</p>
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
                                    className="py-2.5 rounded-xl text-[12px] font-medium transition-colors bg-white border border-[#E5E7EB] text-[#3D3D3D] hover:border-[#0F766E] hover:text-[#0F766E]"
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
                                    className="py-1.5 rounded-xl text-[12px] font-medium transition-colors leading-tight bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100"
                                  >
                                    <span className="block">{formatTime(slot.time)}</span>
                                    <span className="text-[9px] mt-0.5 flex items-center justify-center gap-0.5">
                                      <Users size={8} /> {zh ? '輪候' : 'Waitlist'}
                                    </span>
                                  </button>
                                );
                              }

                              return (
                                <button
                                  key={slot.time}
                                  disabled
                                  className="py-2.5 rounded-xl text-[12px] font-medium bg-[#F9FAFB] text-[#D1D5DB] border border-[#F3F4F6] cursor-not-allowed line-through"
                                >
                                  {formatTime(slot.time)}
                                </button>
                              );
                            })}
                          </div>

                          {availableSlots.some((s) => s.waitlistable) && (
                            <div className="mt-3 flex items-center gap-1.5 text-[10px] text-[#9CA3AF]">
                              <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-700 px-1.5 py-0.5 rounded-full">
                                <Users size={9} /> {zh ? '輪候' : 'Waitlist'}
                              </span>
                              <span>{zh ? '＝ 此時段已滿' : '= Fully booked — join waitlist'}</span>
                            </div>
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
              <div className="flex items-center gap-2.5 bg-[#ECFDF5] border border-[#A7F3D0] rounded-2xl px-3.5 py-3 animate-fade-in">
                <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center shrink-0">
                  <MessageCircle size={16} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-[#065F46]">
                    {zh ? 'WhatsApp 自動提醒' : 'WhatsApp reminder scheduled'}
                  </p>
                  <p className="text-[10px] text-[#047857]">
                    {zh ? '預約確認後將透過 WhatsApp 提醒你' : 'You\'ll be reminded via WhatsApp'}
                  </p>
                </div>
              </div>
            )}

            {/* ── Inline details form (revealed once service + time chosen) ── */}
            {selectedService && selectedTime && (
              <section className="animate-fade-up">
                <h2 className="text-[15px] font-semibold text-[#111111] mb-3">{t('yourDetails')}</h2>

                <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 space-y-4">
                  <Input id="customerName" label={t('name')} value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder={zh ? '你的姓名' : 'Your name'} required />
                  <div className="space-y-1.5">
                    <label htmlFor="customerPhone" className="block text-xs font-medium text-[#3D3D3D]">
                      WhatsApp {isWaitlistSlot && <span className="text-amber-600 font-normal">({zh ? '通知用' : 'for notifications'})</span>}
                    </label>
                    <Input id="customerPhone" type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="+852 9XXX XXXX" required />
                  </div>

                  {!isWaitlistSlot && (
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-[#3D3D3D]">
                        {t('notes')} <span className="text-[#9CA3AF] font-normal">({t('optional')})</span>
                      </label>
                      <textarea
                        value={customerNotes}
                        onChange={(e) => setCustomerNotes(e.target.value)}
                        placeholder={t('notesPlaceholder')}
                        rows={1}
                        className="w-full px-3.5 py-2.5 text-sm border border-[#E5E7EB] rounded-lg bg-white text-[#111111] placeholder:text-[#D1D5DB] focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] resize-none"
                      />
                    </div>
                  )}

                  {!isWaitlistSlot && selectedService?.allow_customer_image && (
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-[#3D3D3D]">
                        {zh ? '上傳圖片' : 'Upload Image'}
                        <span className="text-[#9CA3AF] font-normal ml-1">({t('optional')})</span>
                      </label>
                      {customerImageUrl ? (
                        <div className="relative w-full">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={customerImageUrl}
                            alt={zh ? '已上傳圖片' : 'Uploaded image'}
                            className="w-full h-44 object-cover rounded-xl border border-[#E5E7EB]"
                          />
                          <button
                            type="button"
                            onClick={() => setCustomerImageUrl('')}
                            className="absolute top-2 right-2 bg-white border border-[#E5E7EB] rounded-full p-1 hover:bg-red-50 text-[#6B7280] hover:text-red-500 transition-colors shadow-sm"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-[#E5E7EB] rounded-xl cursor-pointer hover:border-[#0F766E] hover:bg-[#CCFBF1]/10 transition-colors">
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
                              <span className="text-xs">{zh ? '上傳中...' : 'Uploading...'}</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1.5 text-[#9CA3AF]">
                              <ImagePlus size={22} />
                              <span className="text-xs font-medium text-[#6B7280]">
                                {zh ? '點擊選擇圖片' : 'Tap to choose an image'}
                              </span>
                              <span className="text-[10px]">{zh ? 'JPG、PNG，最大 10MB' : 'JPG, PNG up to 10 MB'}</span>
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
                    <div className="rounded-xl border border-[#E5E7EB] bg-[#FAFAFB] p-4">
                      <div className="mb-3">
                        <p className="text-sm font-semibold text-[#111111]">
                          {zh ? '預約小問題' : 'Booking Questions'}
                        </p>
                        <p className="text-xs text-[#6B7280] mt-1">
                          {zh ? '只需快速回答幾條簡短問題。' : 'A few quick answers to help the business prepare.'}
                        </p>
                      </div>

                      <div className="space-y-4">
                        {visibleQuestions.map((question) => (
                          <div key={question.id} className="space-y-2">
                            <label className="block text-xs font-medium text-[#3D3D3D]">
                              {question.question_text}
                              {question.is_required && <span className="ml-1 text-red-500">*</span>}
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
                                className="w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-white text-[#3D3D3D] text-sm transition-colors appearance-none focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]"
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
                                          ? 'border-[#0F766E] bg-[#CCFBF1]/40 text-[#0F766E]'
                                          : 'border-[#E5E7EB] bg-white text-[#3D3D3D] hover:border-[#0F766E]'
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

                  <div className="p-3 bg-[#F9FAFB] rounded-lg">
                    <p className="text-xs font-medium text-[#6B7280] mb-0.5">{t('pdpoNotice')}</p>
                    <p className="text-xs text-[#9CA3AF]">{t('pdpoText')}</p>
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
          <div className="animate-fade-in">
            <button
              onClick={() => setStep('select')}
              className="flex items-center gap-1 text-xs text-[#6B7280] mb-3 hover:text-[#111111] transition-colors cursor-pointer"
            >
              <ChevronLeft size={14} /> {t('back')}
            </button>

            <h2 className="text-[15px] font-semibold text-[#111111] mb-3">
              {isWaitlistSlot
                ? (zh ? '確認輪候名單資料' : 'Confirm Waitlist Details')
                : t('bookingSummary')}
            </h2>

            {isWaitlistSlot && (
              <div className="mb-3 flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-2xl px-3.5 py-3 text-xs text-amber-800">
                <Users size={14} className="shrink-0 mt-0.5 text-amber-600" />
                <p>
                  {zh
                    ? '此時段已滿。確認後你將加入輪候名單，並透過 WhatsApp 收到通知。'
                    : 'This slot is fully booked. Confirm to join the waitlist — you\'ll be notified via WhatsApp if a spot opens.'}
                </p>
              </div>
            )}

            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
              <div className="space-y-3">
                {[
                  [t('service'), zh && selectedService.name_zh ? selectedService.name_zh : selectedService.name],
                  [t('date'), format(selectedDate, 'MMM d, yyyy (EEEE)')],
                  [t('time'), formatTime(selectedTime)],
                  [t('duration'), `${selectedService.duration_minutes}${zh ? '分鐘' : ' min'}`],
                  ...(!isWaitlistSlot && selectedService.pricing_type === 'tbc'
                    ? [[t('price'), zh ? '待確認（確認預約時告知）' : 'TBC (confirmed by business)']]
                    : selectedService.price_hkd && !isWaitlistSlot
                      ? [[t('price'), formatPrice(selectedService.price_hkd)]]
                      : []),
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-[#6B7280]">{label}</span>
                    <span className="font-medium text-[#111111]">{value}</span>
                  </div>
                ))}
                <div className="h-px bg-[#E5E7EB] my-1" />
                {[
                  [t('name'), customerName],
                  ['WhatsApp', customerPhone],
                  ...(!isWaitlistSlot
                    ? visibleQuestions
                        .filter((question) => questionAnswers[question.id]?.trim())
                        .map((question) => [question.question_text, questionAnswers[question.id]])
                    : []),
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-[#6B7280]">{label}</span>
                    <span className="font-medium text-[#111111] text-right max-w-[60%] whitespace-pre-wrap">{value}</span>
                  </div>
                ))}
              </div>

              {bookingError && (
                <div className="mt-4 px-3.5 py-2.5 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">
                  {bookingError}
                </div>
              )}
            </div>

            {/* Business contact card (small, persistent context) */}
            {business && (business.address_text || business.address_map_link || business.phone) && (
              <div className="mt-4 bg-white border border-[#E5E7EB] rounded-2xl p-4 space-y-2">
                <p className="text-[10px] font-semibold tracking-wide text-[#6B7280] uppercase">
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
                    <ExternalLink size={12} />
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
                    <span className="text-[#0F766E]">☎</span>
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
                          className="inline-flex items-center gap-1 rounded-full border border-[#D1FAE5] bg-[#ECFDF5] px-2 py-0.5 text-[10px] font-medium text-[#0F766E] hover:bg-[#D1FAE5]"
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
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#E5E7EB] bg-white/95 backdrop-blur-sm">
        <div className="max-w-md mx-auto px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {step === 'select' && (
            <>
              {/* Selected summary line */}
              {selectedService && selectedTime && (
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-[11px] text-[#6B7280] truncate">
                    {zh && selectedService.name_zh ? selectedService.name_zh : selectedService.name}
                    {' · '}{format(selectedDate, zh ? 'M月d日' : 'MMM d')}{' · '}{formatTime(selectedTime)}
                  </span>
                  {selectedService.price_hkd && !isWaitlistSlot && (
                    <span className="text-[12px] font-bold text-[#111111] shrink-0 ml-2">
                      {formatPrice(selectedService.price_hkd)}
                    </span>
                  )}
                </div>
              )}
              <button
                disabled={!canProceedFromSelect || !customerName.trim() || !customerPhone.trim() || Boolean(!isWaitlistSlot && missingRequiredQuestion)}
                onClick={() => setStep('confirm')}
                className={`w-full py-3.5 rounded-2xl text-[15px] font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${
                  ctaWaitlist
                    ? 'bg-amber-500 hover:bg-amber-600 text-white'
                    : 'bg-[#0F766E] hover:bg-[#0D9488] text-white'
                }`}
              >
                {ctaWaitlist ? (
                  <><Users size={16} />{zh ? '加入輪候名單' : 'Join Waitlist'}</>
                ) : (
                  <>{t('bookNow')}<ArrowRight size={16} /></>
                )}
              </button>
              <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-[#9CA3AF]">
                <ShieldCheck size={11} className="text-[#0F766E]" />
                <span>{zh ? '安全預約' : 'Secure booking'}</span>
              </div>
            </>
          )}

          {step === 'confirm' && (
            <button
              onClick={isWaitlistSlot ? handleWaitlistSubmit : handleSubmit}
              disabled={submitting}
              className={`w-full py-3.5 rounded-2xl text-[15px] font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 ${
                isWaitlistSlot ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-[#0F766E] hover:bg-[#0D9488] text-white'
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
                <><Users size={16} />{zh ? '加入輪候名單' : 'Join Waitlist'}</>
              ) : t('confirmBooking')}
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
