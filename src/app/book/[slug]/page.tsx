'use client';

import { useEffect, useState, useCallback } from 'react';
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
import { Check, ChevronLeft, ChevronRight, Calendar, ArrowRight, Clock, MapPin, Phone, ExternalLink, Users, Timer } from 'lucide-react';

type BookingStep = 'service' | 'datetime' | 'details' | 'confirm' | 'done';

/** Extends TimeSlot with a waitlistable flag.
 * waitlistable = true  → slot is fully booked but NOT blocked by the business,
 *                        so the customer may join the waitlist.
 * waitlistable = false → slot is blocked by the business or during break;
 *                        no waitlist option shown.
 */
type SlotInfo = { time: string; available: boolean; waitlistable: boolean };

// ── Step indicator ──────────────────────────────────────────────────────────
const STEP_LABELS_ZH = ['選擇服務', '選擇時間', '填寫資料', '確認預約'];
const STEP_LABELS_EN = ['Service', 'Date & Time', 'Details', 'Confirm'];

const SOCIAL_LABELS = {
  instagram: 'Instagram',
  threads: 'Threads',
  facebook: 'Facebook',
  other: 'Link',
} as const;

function StepIndicator({ step, zh }: { step: BookingStep; zh: boolean }) {
  const STEPS: BookingStep[] = ['service', 'datetime', 'details', 'confirm'];
  const currentIdx = STEPS.indexOf(step);
  const labels = zh ? STEP_LABELS_ZH : STEP_LABELS_EN;

  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((s, i) => {
        const isCompleted = currentIdx > i;
        const isActive = currentIdx === i;
        return (
          <div key={s} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors ${
                  isCompleted
                    ? 'bg-[#0F766E] border-[#0F766E] text-white'
                    : isActive
                    ? 'bg-white border-[#0F766E] text-[#0F766E]'
                    : 'bg-white border-[#E5E7EB] text-[#9CA3AF]'
                }`}
              >
                {isCompleted ? <Check size={13} /> : i + 1}
              </div>
              <span className={`text-[10px] whitespace-nowrap hidden sm:block ${isActive ? 'text-[#0F766E] font-medium' : 'text-[#9CA3AF]'}`}>
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

// ── Calendar ────────────────────────────────────────────────────────────────
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
  const startPad = getDay(monthStart); // 0=Sun
  const allCells = [...Array(startPad).fill(null), ...days];

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
      {/* Month header */}
      <div className="flex items-center justify-between mb-4">
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

      {/* Day labels */}
      <div className="grid grid-cols-7 mb-1">
        {dayLabels.map((d) => (
          <div key={d} className="text-center text-[11px] font-medium text-[#9CA3AF] py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Date cells */}
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
              onClick={() => !disabled && onSelect(day)}
              disabled={disabled}
              className={`aspect-square flex items-center justify-center text-xs rounded-lg font-medium transition-colors ${
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

// ── Booking Summary Panel ───────────────────────────────────────────────────
function SummaryPanel({
  business,
  selectedService,
  selectedDate,
  selectedTime,
  zh,
}: {
  business: Business;
  selectedService: Service | null;
  selectedDate: Date;
  selectedTime: string;
  zh: boolean;
}) {
  const socialLinks = parseBusinessSocialLinks(business.social_links);
  const socialEntries = Object.entries(socialLinks).filter(([, url]) => Boolean(url));

  return (
    <div className="space-y-3 sticky top-24">
      {/* Selected booking */}
      {selectedService && (
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
          <p className="text-xs font-semibold tracking-wide text-[#0F766E] uppercase mb-3">
            {zh ? '已選擇' : 'Selected'}
          </p>
          <div className="flex items-start justify-between mb-1">
            <p className="text-sm font-semibold text-[#111111]">
              {zh && selectedService.name_zh ? selectedService.name_zh : selectedService.name}
            </p>
            {selectedService.price_hkd && (
              <span className="text-sm font-bold text-[#111111]">{formatPrice(selectedService.price_hkd)}</span>
            )}
          </div>
          <p className="text-xs text-[#6B7280] mb-2">
            {selectedService.duration_minutes}{zh ? '分鐘' : ' min'}
            {selectedService.name_zh ? ` · ${selectedService.name_zh}` : ''}
          </p>
          {selectedTime && (
            <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-[#F3F4F6]">
              <Calendar size={12} className="text-[#0F766E]" />
              <span className="text-xs text-[#3D3D3D]">
                {format(selectedDate, zh ? 'M月d日' : 'MMM d')} · {formatTime(selectedTime)}–{formatTime(addMinutesToTime(selectedTime, selectedService.duration_minutes))}
              </span>
            </div>
          )}
          {!selectedTime && (
            <p className="text-xs text-[#9CA3AF] italic mt-1">
              {zh ? '* 請選擇時間' : '* Select a time slot'}
            </p>
          )}
        </div>
      )}

      {/* Business info */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 space-y-2.5">
        <p className="text-xs font-semibold tracking-wide text-[#6B7280] uppercase mb-1">
          {zh ? '商戶資料' : 'Business'}
        </p>
        {business.business_image_url && (
          <div className="overflow-hidden rounded-xl border border-[#E5E7EB]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={business.business_image_url}
              alt={business.name}
              className="h-36 w-full object-cover"
            />
          </div>
        )}
        {business.address_map_link && (
          <a
            href={business.address_map_link}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-xs text-[#0F766E] hover:underline"
          >
            <MapPin size={12} className="flex-shrink-0" />
            <span>{zh ? '查看 Google 地圖' : 'Open in Google Maps'}</span>
            <ExternalLink size={12} className="flex-shrink-0" />
          </a>
        )}
        {business.address_text && (
          <div className="flex items-start gap-2 text-xs text-[#3D3D3D]">
            <MapPin size={12} className="mt-0.5 text-[#0F766E] flex-shrink-0" />
            <span>{business.address_text}</span>
          </div>
        )}
        {business.district && (
          <div className="flex items-center gap-2 text-xs text-[#3D3D3D]">
            <MapPin size={12} className="text-[#0F766E] flex-shrink-0" />
            <span>{business.district}</span>
          </div>
        )}
        {business.phone && (
          <div className="flex items-center gap-2 text-xs text-[#3D3D3D]">
            <Phone size={12} className="text-[#0F766E] flex-shrink-0" />
            <span>{business.phone}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-xs text-[#3D3D3D]">
          <Clock size={12} className="text-[#0F766E] flex-shrink-0" />
          <span>{zh ? '11:00 – 20:00' : '11:00 – 20:00'}</span>
        </div>
        {socialEntries.length > 0 && (
          <div className="pt-1">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[#9CA3AF]">
              {zh ? '社交媒體' : 'Social'}
            </p>
            <div className="flex flex-wrap gap-2">
              {socialEntries.map(([platform, url]) => (
                <a
                  key={platform}
                  href={url as string}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-[#D1FAE5] bg-[#ECFDF5] px-2.5 py-1 text-[11px] font-medium text-[#0F766E] hover:bg-[#D1FAE5]"
                >
                  <span>{SOCIAL_LABELS[platform as keyof typeof SOCIAL_LABELS]}</span>
                  <ExternalLink size={11} />
                </a>
              ))}
            </div>
          </div>
        )}
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

  const [step, setStep] = useState<BookingStep>('service');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<SlotInfo[]>([]);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [bookingSubmittedMessage, setBookingSubmittedMessage] = useState('');

  // ── Waitlist state ─────────────────────────────────────────────────────────
  /** true when the selected time slot is fully booked and user is joining the waitlist */
  const [isWaitlistSlot, setIsWaitlistSlot] = useState(false);
  /** Queue position returned by POST /api/waitlist after a successful join */
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
    setQuestionAnswers((current) => ({
      ...current,
      [questionId]: answer,
    }));
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
          const prefillDate = new Date(`${pDate}T12:00:00`); // noon avoids tz day-flip
          setSelectedService(prefillService);
          setSelectedDate(prefillDate);
          setSelectedTime(pTime);
          // Jump straight to details — the customer just needs to confirm their info
          setStep('details');
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
        // Fully-booked (conflict) but NOT owner-blocked → waitlist eligible
        waitlistable: hasConflict && !isBlocked,
      });
    }
    setAvailableSlots(slots);
  }, [business, selectedService, hours]);

  useEffect(() => {
    if (step === 'datetime' && selectedService) loadSlotsForDate(selectedDate);
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

  // ── Waitlist submission ────────────────────────────────────────────────────
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
          // Already on the list — surface their existing position
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

          {/* Icon */}
          <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${isWaitlistDone ? 'bg-amber-50' : 'bg-[#D1FAE5]'}`}>
            {isWaitlistDone
              ? <Users className="text-amber-600" size={24} />
              : <Check className="text-[#065F46]" size={24} />
            }
          </div>

          {isWaitlistDone ? (
            /* ── Waitlist confirmation ── */
            <>
              <h2 className="text-xl font-semibold text-[#111111] mb-1">
                {zh ? '已加入輪候名單！' : 'Added to Waitlist!'}
              </h2>
              <p className="text-sm text-[#6B7280] mb-4">
                {zh
                  ? '若有人取消預約，我們將透過 WhatsApp 通知你。'
                  : 'If a cancellation occurs, we\'ll notify you via WhatsApp.'}
              </p>

              {/* Position badge */}
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

              {/* Slot summary */}
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
            /* ── Normal booking confirmation ── */
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

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* ── NAV ── */}
      <div className="bg-white border-b border-[#E5E7EB] sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {business?.business_image_url ? (
              <div className="w-9 h-9 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={business.business_image_url} alt={business.name} className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-xl bg-[#CCFBF1] flex items-center justify-center text-base">
                {getBusinessTypeEmoji(business?.type || '')}
              </div>
            )}
            <div>
              <h1 className="text-sm font-semibold text-[#111111] leading-tight">{business?.name}</h1>
              {business?.district && (
                <p className="text-xs text-[#6B7280]">
                  {business.district}{business?.phone ? ` · ${business.phone}` : ''}
                  {' · '}11:00–20:00
                </p>
              )}
            </div>
          </div>
          <LanguageToggle />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Step indicator */}
        <StepIndicator step={step} zh={zh} />

        <div className="grid lg:grid-cols-[1fr_260px] gap-5">
          {/* ── Left: main content ── */}
          <div>

            {/* Step 1: Select Service */}
            {step === 'service' && (
              <div>
                <h2 className="text-base font-semibold text-[#111111] mb-4">{t('selectService')}</h2>
                <div className="space-y-2.5">
                  {services.map((svc) => (
                    <button
                      key={svc.id}
                      onClick={() => {
                        setSelectedService(svc);
                        setQuestionAnswers({});
                        setStep('datetime');
                      }}
                      className="w-full text-left px-4 py-4 bg-white border border-[#E5E7EB] rounded-xl hover:border-[#0F766E] hover:bg-[#CCFBF1]/10 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-[#111111]">
                            {zh && svc.name_zh ? svc.name_zh : svc.name}
                          </p>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-[#6B7280]">
                            <span className="flex items-center gap-1"><Clock size={11} /> {svc.duration_minutes}{zh ? '分鐘' : ' min'}</span>
                            {svc.price_hkd && <span className="font-semibold text-[#111111]">{formatPrice(svc.price_hkd)}</span>}
                          </div>
                        </div>
                        <ArrowRight size={16} className="text-[#D1D5DB] group-hover:text-[#0F766E] transition-colors" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Date & Time */}
            {step === 'datetime' && (
              <div>
                <button
                  onClick={() => { setStep('service'); setSelectedTime(''); }}
                  className="flex items-center gap-1 text-xs text-[#6B7280] mb-4 hover:text-[#111111] transition-colors cursor-pointer"
                >
                  <ChevronLeft size={14} /> {t('back')}
                </button>

                <h2 className="text-base font-semibold text-[#111111] mb-1">{t('selectDateTime')}</h2>
                {selectedService && (
                  <p className="text-xs text-[#6B7280] mb-5">
                    {zh && selectedService.name_zh ? selectedService.name_zh : selectedService.name}
                    {' · '}{selectedService.duration_minutes}{zh ? '分鐘' : ' min'}
                  </p>
                )}

                {/* Calendar */}
                <CalendarPicker
                  selectedDate={selectedDate}
                  onSelect={(d) => { setSelectedDate(d); setSelectedTime(''); }}
                  maxDate={maxDate}
                  zh={zh}
                />

                {/* Time slots */}
                <div className="mt-4">
                  <p className="text-xs font-medium text-[#3D3D3D] mb-3">
                    {format(selectedDate, zh ? 'M月d日' : 'MMM d')}{zh ? '・可用時段' : ' — Available slots'}
                  </p>
                  {availableSlots.length === 0 ? (
                    <div className="text-center py-8 text-[#6B7280] bg-white border border-[#E5E7EB] rounded-xl">
                      <Calendar size={24} className="mx-auto mb-2 opacity-40" />
                      <p className="text-sm">{t('noAvailableSlots')}</p>
                      <p className="text-xs mt-1 opacity-70">{t('selectAnotherDate')}</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-4 gap-2">
                        {availableSlots.map((slot) => {
                          const isSelected = selectedTime === slot.time;

                          // ── Available slot ────────────────────────────────
                          if (slot.available) {
                            return (
                              <button
                                key={slot.time}
                                onClick={() => {
                                  setSelectedTime(slot.time);
                                  setIsWaitlistSlot(false);
                                }}
                                className={`py-2.5 rounded-lg text-xs font-medium transition-colors ${
                                  isSelected
                                    ? 'bg-[#0F766E] text-white shadow-sm'
                                    : 'bg-white border border-[#E5E7EB] text-[#3D3D3D] hover:border-[#0F766E] hover:text-[#0F766E]'
                                }`}
                              >
                                {formatTime(slot.time)}
                              </button>
                            );
                          }

                          // ── Fully booked — show Join Waitlist ─────────────
                          if (slot.waitlistable) {
                            return (
                              <button
                                key={slot.time}
                                onClick={() => {
                                  setSelectedTime(slot.time);
                                  setIsWaitlistSlot(true);
                                  setStep('details');
                                }}
                                title={zh ? '此時段已滿，點擊加入輪候' : 'Slot full — click to join waitlist'}
                                className={`py-1.5 rounded-lg text-xs font-medium transition-colors leading-tight ${
                                  isSelected && isWaitlistSlot
                                    ? 'bg-amber-500 text-white shadow-sm border border-amber-500'
                                    : 'bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 hover:border-amber-400'
                                }`}
                              >
                                <span className="block">{formatTime(slot.time)}</span>
                                <span className="block text-[10px] mt-0.5 flex items-center justify-center gap-0.5">
                                  <Users size={9} className="inline" />
                                  {zh ? '輪候' : 'Waitlist'}
                                </span>
                              </button>
                            );
                          }

                          // ── Blocked by business / break ──────────────────
                          return (
                            <button
                              key={slot.time}
                              disabled
                              className="py-2.5 rounded-lg text-xs font-medium bg-[#F9FAFB] text-[#D1D5DB] border border-[#F3F4F6] cursor-not-allowed line-through"
                            >
                              {formatTime(slot.time)}
                            </button>
                          );
                        })}
                      </div>

                      {/* Legend */}
                      {availableSlots.some((s) => s.waitlistable) && (
                        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-[#9CA3AF]">
                          <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded-full">
                            <Users size={10} /> {zh ? '輪候' : 'Waitlist'}
                          </span>
                          <span>{zh ? '= 此時段已滿，可加入輪候名單' : '= Fully booked — you can join the waitlist'}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {selectedTime && (
                  <button
                    onClick={() => setStep('details')}
                    className="w-full mt-5 py-2.5 bg-[#0F766E] text-white text-sm font-medium rounded-lg hover:bg-[#0D9488] transition-colors flex items-center justify-center gap-2"
                  >
                    {t('next')} <ArrowRight size={14} />
                  </button>
                )}
              </div>
            )}

            {/* Step 3: Customer Details */}
            {step === 'details' && (
              <div>
                <button
                  onClick={() => setStep('datetime')}
                  className="flex items-center gap-1 text-xs text-[#6B7280] mb-4 hover:text-[#111111] transition-colors cursor-pointer"
                >
                  <ChevronLeft size={14} /> {t('back')}
                </button>

                <h2 className="text-base font-semibold text-[#111111] mb-1">{t('yourDetails')}</h2>

                {/* Waitlist context banner */}
                {isWaitlistSlot && (
                  <div className="mb-4 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5 text-xs text-amber-800">
                    <Users size={13} className="shrink-0 text-amber-600" />
                    <span>
                      {zh
                        ? `輪候: ${formatTime(selectedTime)} · ${format(selectedDate, 'M月d日')}`
                        : `Waitlist for ${formatTime(selectedTime)} · ${format(selectedDate, 'MMM d')}`}
                    </span>
                  </div>
                )}

                <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 mt-3">
                  <div className="space-y-4">
                    <Input id="customerName" label={t('name')} value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder={zh ? '你的姓名' : 'Your name'} required />
                    <div className="space-y-1.5">
                      <label htmlFor="customerPhone" className="block text-xs font-medium text-[#3D3D3D]">
                        WhatsApp {isWaitlistSlot && <span className="text-amber-600 font-normal">({zh ? '通知用' : 'for notifications'})</span>}
                      </label>
                      <Input id="customerPhone" type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="+852 9XXX XXXX" required />
                    </div>
                    {/* Notes — only shown for regular bookings */}
                    {!isWaitlistSlot && (
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-[#3D3D3D]">
                          {t('notes')} <span className="text-[#9CA3AF] font-normal">({t('optional')})</span>
                        </label>
                        <textarea
                          value={customerNotes}
                          onChange={(e) => setCustomerNotes(e.target.value)}
                          placeholder={t('notesPlaceholder')}
                          rows={3}
                          className="w-full px-3.5 py-2.5 text-sm border border-[#E5E7EB] rounded-lg bg-white text-[#111111] placeholder:text-[#D1D5DB] focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] resize-none"
                        />
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
                                    <option key={option} value={option}>
                                      {option}
                                    </option>
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
                  <button
                    onClick={() => setStep('confirm')}
                    disabled={!customerName.trim() || !customerPhone.trim() || Boolean(!isWaitlistSlot && missingRequiredQuestion)}
                    className={`w-full mt-5 py-2.5 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                      isWaitlistSlot ? 'bg-amber-500 hover:bg-amber-600' : 'bg-[#0F766E] hover:bg-[#0D9488]'
                    }`}
                  >
                    {t('next')} <ArrowRight size={14} />
                  </button>
                  {!isWaitlistSlot && missingRequiredQuestion && (
                    <p className="mt-3 text-xs text-red-500">
                      {zh ? '請先完成所有必填問題。' : 'Please complete all required questions before continuing.'}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Step 4: Confirm */}
            {step === 'confirm' && selectedService && (
              <div>
                <button
                  onClick={() => setStep('details')}
                  className="flex items-center gap-1 text-xs text-[#6B7280] mb-4 hover:text-[#111111] transition-colors cursor-pointer"
                >
                  <ChevronLeft size={14} /> {t('back')}
                </button>

                <h2 className="text-base font-semibold text-[#111111] mb-1">
                  {isWaitlistSlot
                    ? (zh ? '確認輪候名單資料' : 'Confirm Waitlist Details')
                    : t('bookingSummary')}
                </h2>

                {/* Waitlist notice banner */}
                {isWaitlistSlot && (
                  <div className="mb-4 flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3 text-xs text-amber-800">
                    <Users size={14} className="shrink-0 mt-0.5 text-amber-600" />
                    <p>
                      {zh
                        ? '此時段已滿。確認後你將加入輪候名單，並透過 WhatsApp 收到通知。'
                        : 'This slot is fully booked. Confirm to join the waitlist — you\'ll be notified via WhatsApp if a spot opens.'}
                    </p>
                  </div>
                )}

                <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
                  <div className="space-y-3">
                    {[
                      [t('service'), zh && selectedService.name_zh ? selectedService.name_zh : selectedService.name],
                      [t('date'), format(selectedDate, 'MMM d, yyyy (EEEE)')],
                      [t('time'), formatTime(selectedTime)],
                      [t('duration'), `${selectedService.duration_minutes}${zh ? '分鐘' : ' min'}`],
                      ...(selectedService.price_hkd && !isWaitlistSlot ? [[t('price'), formatPrice(selectedService.price_hkd)]] : []),
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between text-sm">
                        <span className="text-[#6B7280]">{label}</span>
                        <span className="font-medium text-[#111111]">{value}</span>
                      </div>
                    ))}
                    <div className="h-px bg-[#E5E7EB] my-1" />
                    {[
                      [t('name'), customerName],
                      [zh ? 'WhatsApp' : 'WhatsApp', customerPhone],
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

                  <button
                    onClick={isWaitlistSlot ? handleWaitlistSubmit : handleSubmit}
                    disabled={submitting}
                    className={`w-full mt-5 py-2.5 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2 ${
                      isWaitlistSlot
                        ? 'bg-amber-500 hover:bg-amber-600'
                        : 'bg-[#0F766E] hover:bg-[#0D9488]'
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
                      <>
                        <Users size={15} />
                        {zh ? '加入輪候名單' : 'Join Waitlist'}
                      </>
                    ) : t('confirmBooking')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Right: Summary Panel (desktop only) ── */}
          {business && step !== 'service' && (
            <div className="hidden lg:block">
              <SummaryPanel
                business={business}
                selectedService={selectedService}
                selectedDate={selectedDate}
                selectedTime={selectedTime}
                zh={zh}
              />
            </div>
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
