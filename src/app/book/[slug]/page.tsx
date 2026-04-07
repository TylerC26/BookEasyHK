'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { I18nProvider, useI18n } from '@/lib/i18n/context';
import { LanguageToggle } from '@/components/language-toggle';
import { formatPrice, formatTime, addMinutesToTime, timeToMinutes, getBusinessTypeEmoji } from '@/lib/utils';
import type { Business, Service, WorkingHours, TimeSlot } from '@/lib/types';
import {
  format, addDays, isBefore, startOfDay, isToday,
  startOfMonth, endOfMonth, eachDayOfInterval, getDay,
  addMonths, subMonths, isSameDay, isSameMonth,
} from 'date-fns';
import { Check, ChevronLeft, ChevronRight, Calendar, ArrowRight, Clock, MapPin, Phone } from 'lucide-react';

type BookingStep = 'service' | 'datetime' | 'details' | 'confirm' | 'done';

// ── Step indicator ──────────────────────────────────────────────────────────
const STEP_LABELS_ZH = ['選擇服務', '選擇時間', '填寫資料', '確認預約'];
const STEP_LABELS_EN = ['Service', 'Date & Time', 'Details', 'Confirm'];

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
  const [hours, setHours] = useState<WorkingHours[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [step, setStep] = useState<BookingStep>('service');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerWhatsapp, setCustomerWhatsapp] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [bookingSubmittedMessage, setBookingSubmittedMessage] = useState('');

  useEffect(() => { loadBusiness(); }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadBusiness = async () => {
    const supabase = createClient();
    const { data: biz } = await supabase.from('businesses').select('*').eq('slug', slug).eq('onboarding_complete', true).single();
    if (!biz) { setNotFound(true); setLoading(false); return; }
    setBusiness(biz);
    const [{ data: svc }, { data: wh }] = await Promise.all([
      supabase.from('services').select('*').eq('business_id', biz.id).eq('active', true).order('sort_order'),
      supabase.from('working_hours').select('*').eq('business_id', biz.id).order('day_of_week'),
    ]);
    setServices(svc || []);
    setHours(wh || []);
    setLoading(false);
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
    const slots: TimeSlot[] = [];
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
      if (breakStartMin !== null && breakEndMin !== null && startMin < breakEndMin && endMin > breakStartMin) continue;
      const hasConflict = (bookings || []).some((b) => { const bStart = timeToMinutes(b.start_time); const bEnd = timeToMinutes(b.end_time) + buffer; return startMin < bEnd && endMin > bStart; });
      const isBlocked = (blocked || []).some((b) => { const bStart = timeToMinutes(b.start_time); const bEnd = timeToMinutes(b.end_time); return startMin < bEnd && endMin > bStart; });
      slots.push({ time: slotTime, available: !hasConflict && !isBlocked });
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
          customer_whatsapp: customerWhatsapp || customerPhone,
          customer_notes: customerNotes || null,
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
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-4">
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-8 text-center max-w-sm w-full shadow-card">
          <div className="w-14 h-14 bg-[#D1FAE5] rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="text-[#065F46]" size={24} />
          </div>
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
            <div className="w-9 h-9 rounded-xl bg-[#CCFBF1] flex items-center justify-center text-base">
              {getBusinessTypeEmoji(business?.type || '')}
            </div>
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
                      onClick={() => { setSelectedService(svc); setStep('datetime'); }}
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
                    <div className="grid grid-cols-4 gap-2">
                      {availableSlots.map((slot) => (
                        <button
                          key={slot.time}
                          onClick={() => { if (slot.available) setSelectedTime(slot.time); }}
                          disabled={!slot.available}
                          className={`py-2.5 rounded-lg text-xs font-medium transition-colors ${
                            selectedTime === slot.time
                              ? 'bg-[#0F766E] text-white shadow-sm'
                              : slot.available
                                ? 'bg-white border border-[#E5E7EB] text-[#3D3D3D] hover:border-[#0F766E] hover:text-[#0F766E]'
                                : 'bg-[#F9FAFB] text-[#D1D5DB] border border-[#F3F4F6] cursor-not-allowed line-through'
                          }`}
                        >
                          {formatTime(slot.time)}
                        </button>
                      ))}
                    </div>
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
                <h2 className="text-base font-semibold text-[#111111] mb-4">{t('yourDetails')}</h2>
                <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
                  <div className="space-y-4">
                    <Input id="customerName" label={t('name')} value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder={zh ? '你的姓名' : 'Your name'} required />
                    <Input id="customerPhone" label={t('phoneNumber')} type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="+852 9XXX XXXX" required />
                    <Input id="customerWhatsapp" label={`WhatsApp ${t('phoneNumber')}`} type="tel" value={customerWhatsapp} onChange={(e) => setCustomerWhatsapp(e.target.value)} placeholder="+852 9XXX XXXX" hint={zh ? '如與電話號碼相同可留空' : 'Leave blank if same as phone'} />
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
                    <div className="p-3 bg-[#F9FAFB] rounded-lg">
                      <p className="text-xs font-medium text-[#6B7280] mb-0.5">{t('pdpoNotice')}</p>
                      <p className="text-xs text-[#9CA3AF]">{t('pdpoText')}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setStep('confirm')}
                    disabled={!customerName.trim() || !customerPhone.trim()}
                    className="w-full mt-5 py-2.5 bg-[#0F766E] text-white text-sm font-medium rounded-lg hover:bg-[#0D9488] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {t('next')} <ArrowRight size={14} />
                  </button>
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
                <h2 className="text-base font-semibold text-[#111111] mb-4">{t('bookingSummary')}</h2>
                <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
                  <div className="space-y-3">
                    {[
                      [t('service'), zh && selectedService.name_zh ? selectedService.name_zh : selectedService.name],
                      [t('date'), format(selectedDate, 'MMM d, yyyy (EEEE)')],
                      [t('time'), formatTime(selectedTime)],
                      [t('duration'), `${selectedService.duration_minutes}${zh ? '分鐘' : ' min'}`],
                      ...(selectedService.price_hkd ? [[t('price'), formatPrice(selectedService.price_hkd)]] : []),
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between text-sm">
                        <span className="text-[#6B7280]">{label}</span>
                        <span className="font-medium text-[#111111]">{value}</span>
                      </div>
                    ))}
                    <div className="h-px bg-[#E5E7EB] my-1" />
                    {[
                      [t('name'), customerName],
                      [t('phoneNumber'), customerPhone],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between text-sm">
                        <span className="text-[#6B7280]">{label}</span>
                        <span className="font-medium text-[#111111]">{value}</span>
                      </div>
                    ))}
                  </div>

                  {bookingError && (
                    <div className="mt-4 px-3.5 py-2.5 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">
                      {bookingError}
                    </div>
                  )}

                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="w-full mt-5 py-2.5 bg-[#0F766E] text-white text-sm font-medium rounded-lg hover:bg-[#0D9488] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>{zh ? '確認中⋯' : 'Confirming…'}</>
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
