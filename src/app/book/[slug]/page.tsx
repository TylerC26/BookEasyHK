'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { I18nProvider, useI18n } from '@/lib/i18n/context';
import { LanguageToggle } from '@/components/language-toggle';
import { formatPrice, formatTime, addMinutesToTime, timeToMinutes, getBusinessTypeEmoji } from '@/lib/utils';
import type { Business, Service, WorkingHours, TimeSlot, Booking } from '@/lib/types';
import { format, addDays, isBefore, startOfDay, isToday } from 'date-fns';
import { Clock, MapPin, Check, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

type BookingStep = 'service' | 'datetime' | 'details' | 'confirm' | 'done';

function BookingFlow() {
  const { t, locale } = useI18n();
  const params = useParams();
  const slug = params.slug as string;

  const [business, setBusiness] = useState<Business | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [hours, setHours] = useState<WorkingHours[]>([]);
  const [existingBookings, setExistingBookings] = useState<Booking[]>([]);
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

  useEffect(() => {
    loadBusiness();
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadBusiness = async () => {
    const supabase = createClient();

    const { data: biz } = await supabase
      .from('businesses')
      .select('*')
      .eq('slug', slug)
      .eq('onboarding_complete', true)
      .single();

    if (!biz) {
      setNotFound(true);
      setLoading(false);
      return;
    }

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
      supabase
        .from('bookings')
        .select('*')
        .eq('business_id', business.id)
        .eq('booking_date', dateStr)
        .neq('status', 'cancelled'),
      supabase
        .from('blocked_times')
        .select('*')
        .eq('business_id', business.id)
        .eq('blocked_date', dateStr),
    ]);

    setExistingBookings(bookings || []);

    const dayOfWeek = date.getDay();
    const dayHours = hours.find((h) => h.day_of_week === dayOfWeek);

    if (!dayHours || !dayHours.is_open || !dayHours.open_time || !dayHours.close_time) {
      setAvailableSlots([]);
      return;
    }

    const slots: TimeSlot[] = [];
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
      const slotEnd = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;

      if (startMin < nowMin) {
        continue;
      }

      // Skip break time
      if (breakStartMin !== null && breakEndMin !== null) {
        if (startMin < breakEndMin && endMin > breakStartMin) continue;
      }

      // Check existing bookings
      const hasConflict = (bookings || []).some((b) => {
        const bStart = timeToMinutes(b.start_time);
        const bEnd = timeToMinutes(b.end_time) + buffer;
        return startMin < bEnd && endMin > bStart;
      });

      // Check blocked times
      const isBlocked = (blocked || []).some((b) => {
        const bStart = timeToMinutes(b.start_time);
        const bEnd = timeToMinutes(b.end_time);
        return startMin < bEnd && endMin > bStart;
      });

      slots.push({
        time: slotTime,
        available: !hasConflict && !isBlocked,
      });
    }

    setAvailableSlots(slots);
  }, [business, selectedService, hours]);

  useEffect(() => {
    if (step === 'datetime' && selectedService) {
      loadSlotsForDate(selectedDate);
    }
  }, [selectedDate, step, selectedService, loadSlotsForDate]);

  const handleDateChange = (dir: number) => {
    const newDate = addDays(selectedDate, dir);
    const maxDate = addDays(new Date(), business?.max_advance_days || 30);
    if (isBefore(newDate, startOfDay(new Date()))) return;
    if (isBefore(maxDate, newDate)) return;
    setSelectedDate(newDate);
    setSelectedTime('');
  };

  const handleSubmit = async () => {
    if (!business || !selectedService || !selectedTime) return;
    setSubmitting(true);
    setBookingError('');

    try {
      const supabase = createClient();
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const endTime = addMinutesToTime(selectedTime, selectedService.duration_minutes);

      // Double-booking check via RPC
      const { data: hasOverlap } = await supabase.rpc('check_booking_overlap', {
        p_business_id: business.id,
        p_booking_date: dateStr,
        p_start_time: selectedTime,
        p_end_time: endTime,
      });

      if (hasOverlap) {
        setBookingError(t('slotTaken'));
        setSubmitting(false);
        return;
      }

      const { error } = await supabase.from('bookings').insert({
        business_id: business.id,
        service_id: selectedService.id,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_whatsapp: customerWhatsapp || customerPhone,
        customer_notes: customerNotes || null,
        booking_date: dateStr,
        start_time: selectedTime,
        end_time: endTime,
        status: 'confirmed',
      });

      if (error) throw error;

      setStep('done');
    } catch {
      setBookingError(locale === 'zh-HK' ? '預約失敗，請重試。' : 'Booking failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const generateCalendarUrl = () => {
    if (!business || !selectedService || !selectedTime) return '#';
    const dateStr = format(selectedDate, 'yyyyMMdd');
    const startStr = selectedTime.replace(':', '');
    const endStr = addMinutesToTime(selectedTime, selectedService.duration_minutes).replace(':', '');
    const title = encodeURIComponent(`${selectedService.name} @ ${business.name}`);
    const location = encodeURIComponent(business.district || '');
    return `https://calendar.google.com/calendar/r/eventedit?text=${title}&dates=${dateStr}T${startStr}00/${dateStr}T${endStr}00&location=${location}&ctz=Asia/Hong_Kong`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="animate-pulse text-muted">{t('loading')}</div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg px-4">
        <Card className="text-center max-w-md">
          <p className="text-4xl mb-4">🔍</p>
          <h2 className="text-xl font-semibold mb-2">
            {locale === 'zh-HK' ? '找不到此商戶' : 'Business not found'}
          </h2>
          <p className="text-muted text-sm">
            {locale === 'zh-HK' ? '此預約連結可能無效。' : 'This booking link may be invalid.'}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <div className="bg-white border-b border-border sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{getBusinessTypeEmoji(business?.type || '')}</span>
            <h1 className="font-semibold text-secondary">{business?.name}</h1>
          </div>
          <LanguageToggle />
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Progress */}
        {step !== 'done' && (
          <div className="flex gap-2 mb-6">
            {(['service', 'datetime', 'details', 'confirm'] as BookingStep[]).map((s, i) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  ['service', 'datetime', 'details', 'confirm'].indexOf(step) >= i ? 'bg-primary' : 'bg-border'
                }`}
              />
            ))}
          </div>
        )}

        {/* Step: Select Service */}
        {step === 'service' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">{t('selectService')}</h2>
            <div className="space-y-3">
              {services.map((svc) => (
                <button
                  key={svc.id}
                  onClick={() => { setSelectedService(svc); setStep('datetime'); }}
                  className="w-full text-left p-4 bg-white rounded-xl border border-border hover:border-primary hover:shadow-sm transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-secondary">
                        {locale === 'zh-HK' && svc.name_zh ? svc.name_zh : svc.name}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted">
                        <span className="flex items-center gap-1">
                          <Clock size={14} /> {svc.duration_minutes} {t('mins')}
                        </span>
                        {svc.price_hkd && (
                          <span className="font-medium text-secondary">{formatPrice(svc.price_hkd)}</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={20} className="text-muted" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step: Date & Time */}
        {step === 'datetime' && (
          <div>
            <button onClick={() => { setStep('service'); setSelectedTime(''); }} className="flex items-center gap-1 text-sm text-muted mb-4 hover:text-secondary cursor-pointer">
              <ChevronLeft size={16} /> {t('back')}
            </button>
            <h2 className="text-lg font-semibold mb-1">{t('selectDateTime')}</h2>
            {selectedService && (
              <p className="text-sm text-muted mb-4">
                {locale === 'zh-HK' && selectedService.name_zh ? selectedService.name_zh : selectedService.name}
                {' · '}{selectedService.duration_minutes} {t('mins')}
              </p>
            )}

            {/* Date picker */}
            <div className="flex items-center justify-between bg-white rounded-xl border border-border p-3 mb-4">
              <button onClick={() => handleDateChange(-1)} className="p-1 hover:bg-slate-50 rounded-lg cursor-pointer">
                <ChevronLeft size={20} />
              </button>
              <div className="text-center">
                <p className="font-medium">{format(selectedDate, 'EEEE')}</p>
                <p className="text-sm text-muted">{format(selectedDate, 'MMM d, yyyy')}</p>
              </div>
              <button onClick={() => handleDateChange(1)} className="p-1 hover:bg-slate-50 rounded-lg cursor-pointer">
                <ChevronRight size={20} />
              </button>
            </div>

            {/* Time slots */}
            {availableSlots.length === 0 ? (
              <div className="text-center py-8 text-muted">
                <Calendar size={32} className="mx-auto mb-2 opacity-50" />
                <p>{t('noAvailableSlots')}</p>
                <p className="text-sm mt-1">{t('selectAnotherDate')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {availableSlots.map((slot) => (
                  <button
                    key={slot.time}
                    onClick={() => {
                      if (slot.available) {
                        setSelectedTime(slot.time);
                        setStep('details');
                      }
                    }}
                    disabled={!slot.available}
                    className={`py-2.5 px-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                      selectedTime === slot.time
                        ? 'bg-primary text-white'
                        : slot.available
                          ? 'bg-white border border-border hover:border-primary hover:text-primary'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {formatTime(slot.time)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step: Customer Details */}
        {step === 'details' && (
          <div>
            <button onClick={() => setStep('datetime')} className="flex items-center gap-1 text-sm text-muted mb-4 hover:text-secondary cursor-pointer">
              <ChevronLeft size={16} /> {t('back')}
            </button>
            <h2 className="text-lg font-semibold mb-4">{t('yourDetails')}</h2>
            <Card>
              <div className="space-y-4">
                <Input
                  id="customerName"
                  label={t('name')}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder={locale === 'zh-HK' ? '你的姓名' : 'Your name'}
                  required
                />
                <Input
                  id="customerPhone"
                  label={t('phoneNumber')}
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+852 9XXX XXXX"
                  required
                />
                <Input
                  id="customerWhatsapp"
                  label={`WhatsApp ${t('phoneNumber')}`}
                  type="tel"
                  value={customerWhatsapp}
                  onChange={(e) => setCustomerWhatsapp(e.target.value)}
                  placeholder="+852 9XXX XXXX"
                  hint={locale === 'zh-HK' ? '如與電話號碼相同可留空' : 'Leave blank if same as phone'}
                />
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-secondary">
                    {t('notes')} <span className="text-muted font-normal">({t('optional')})</span>
                  </label>
                  <textarea
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                    placeholder={t('notesPlaceholder')}
                    rows={3}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-white text-secondary text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                {/* PDPO Notice */}
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-xs font-medium text-muted mb-1">{t('pdpoNotice')}</p>
                  <p className="text-xs text-muted">{t('pdpoText')}</p>
                </div>
              </div>

              <div className="mt-6">
                <Button
                  className="w-full"
                  onClick={() => setStep('confirm')}
                  disabled={!customerName.trim() || !customerPhone.trim()}
                >
                  {t('next')}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Step: Confirmation */}
        {step === 'confirm' && selectedService && (
          <div>
            <button onClick={() => setStep('details')} className="flex items-center gap-1 text-sm text-muted mb-4 hover:text-secondary cursor-pointer">
              <ChevronLeft size={16} /> {t('back')}
            </button>
            <h2 className="text-lg font-semibold mb-4">{t('bookingSummary')}</h2>
            <Card>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted">{t('service')}</span>
                  <span className="font-medium">
                    {locale === 'zh-HK' && selectedService.name_zh ? selectedService.name_zh : selectedService.name}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">{t('date')}</span>
                  <span className="font-medium">{format(selectedDate, 'MMM d, yyyy (EEEE)')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">{t('time')}</span>
                  <span className="font-medium">{formatTime(selectedTime)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">{t('duration')}</span>
                  <span className="font-medium">{selectedService.duration_minutes} {t('mins')}</span>
                </div>
                {selectedService.price_hkd && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">{t('price')}</span>
                    <span className="font-medium">{formatPrice(selectedService.price_hkd)}</span>
                  </div>
                )}
                <hr className="border-border" />
                <div className="flex justify-between text-sm">
                  <span className="text-muted">{t('name')}</span>
                  <span className="font-medium">{customerName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">{t('phoneNumber')}</span>
                  <span className="font-medium">{customerPhone}</span>
                </div>
              </div>

              {bookingError && (
                <p className="text-sm text-danger bg-red-50 p-3 rounded-lg mt-4">{bookingError}</p>
              )}

              <div className="mt-6">
                <Button className="w-full" onClick={handleSubmit} loading={submitting}>
                  {t('confirmBooking')}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && (
          <Card className="text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="text-emerald-600" size={32} />
            </div>
            <h2 className="text-xl font-bold mb-2">{t('bookingConfirmed')}</h2>
            <p className="text-muted mb-6">{t('bookingConfirmedDesc')}</p>

            {selectedService && (
              <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted">{t('service')}</span>
                  <span className="font-medium">{selectedService.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">{t('date')}</span>
                  <span className="font-medium">{format(selectedDate, 'MMM d, yyyy')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">{t('time')}</span>
                  <span className="font-medium">{formatTime(selectedTime)}</span>
                </div>
              </div>
            )}

            <a
              href={generateCalendarUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Calendar size={16} /> {t('addToCalendar')}
            </a>
          </Card>
        )}
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
