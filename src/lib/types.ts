export type BusinessType = 'nail' | 'hair' | 'carwash' | 'pet' | 'massage' | 'beauty' | 'other';

export interface BusinessSocialLinks {
  instagram?: string | null;
  threads?: string | null;
  facebook?: string | null;
  other?: string | null;
}

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'no_show' | 'cancelled';

export interface Business {
  id: string;
  owner_id: string;
  name: string;
  type: BusinessType;
  district: string | null;
  address_text: string | null;
  address_map_link: string | null;
  phone: string | null;
  whatsapp: string | null;
  slug: string;
  logo_url: string | null;
  business_image_url: string | null;
  social_links: BusinessSocialLinks | null;
  buffer_minutes: number;
  min_advance_hours: number;
  max_advance_days: number;
  language: string;
  onboarding_complete: boolean;
  created_at: string;
  updated_at: string;
}

export type ServicePricingType = 'fixed' | 'tbc';

export interface Service {
  id: string;
  business_id: string;
  name: string;
  name_zh: string | null;
  duration_minutes: number;
  price_hkd: number | null;
  pricing_type: ServicePricingType;
  active: boolean;
  sort_order: number;
  allow_customer_image: boolean;
  image_url: string | null;
  created_at: string;
}

export type BookingQuestionInputType = 'text' | 'select' | 'yes-no';

export interface BookingQuestion {
  id: string;
  business_id: string;
  service_id: string | null;
  question_text: string;
  input_type: BookingQuestionInputType;
  options: string[] | null;
  is_required: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface BookingAnswer {
  booking_id: string;
  question_id: string;
  answer_text: string;
  question?: BookingQuestion;
}

export interface WorkingHours {
  id: string;
  business_id: string;
  day_of_week: number;
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
  break_start: string | null;
  break_end: string | null;
}

export interface Booking {
  id: string;
  business_id: string;
  service_id: string | null;
  price_hkd: number | null;
  owner_notes: string | null;
  owner_image_url: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_whatsapp: string | null;
  customer_email: string | null;
  customer_notes: string | null;
  customer_image_url: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: BookingStatus;
  is_manual: boolean;
  reminder_24h_sent: boolean;
  reminder_2h_sent: boolean;
  created_at: string;
  updated_at: string;
  service?: Service;
  booking_answers?: BookingAnswer[];
}

export interface BlockedTime {
  id: string;
  business_id: string;
  blocked_date: string;
  start_time: string;
  end_time: string;
  reason: string | null;
  created_at: string;
}

export interface TimeSlot {
  time: string;
  available: boolean;
}

// ── Waitlist ─────────────────────────────────────────────────────────────────

export type WaitlistStatus = 'pending' | 'notified' | 'expired' | 'booked';

export interface WaitlistEntry {
  id: string;
  business_id: string;
  service_id: string | null;
  /** ISO timestamp representing the HK-local slot time, stored as UTC */
  slot_datetime: string;
  customer_name: string;
  customer_whatsapp: string;
  /** 1-based queue position within (business_id, slot_datetime) */
  position: number;
  status: WaitlistStatus;
  /** Set when status transitions to 'notified' */
  notified_at: string | null;
  /** notified_at + 30 min — used by the expiry cron */
  expires_at: string | null;
  created_at: string;
}

export interface OnboardingData {
  businessName: string;
  businessType: BusinessType;
  district: string;
  addressText: string;
  addressMapLink: string;
  phone: string;
  whatsapp: string;
  businessImageUrl: string;
  socialLinks: BusinessSocialLinks;
  slug: string;
  services: Array<{
    name: string;
    name_zh: string;
    duration_minutes: number;
    price_hkd: number;
  }>;
  workingHours: Array<{
    day_of_week: number;
    is_open: boolean;
    open_time: string;
    close_time: string;
    break_start: string;
    break_end: string;
  }>;
}
