export type BusinessType = 'nail' | 'hair' | 'carwash' | 'pet' | 'massage' | 'beauty' | 'other';

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'no_show' | 'cancelled';

export interface Business {
  id: string;
  owner_id: string;
  name: string;
  type: BusinessType;
  district: string | null;
  phone: string | null;
  whatsapp: string | null;
  slug: string;
  logo_url: string | null;
  buffer_minutes: number;
  min_advance_hours: number;
  max_advance_days: number;
  language: string;
  onboarding_complete: boolean;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  business_id: string;
  name: string;
  name_zh: string | null;
  duration_minutes: number;
  price_hkd: number | null;
  active: boolean;
  sort_order: number;
  created_at: string;
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

export interface OnboardingData {
  businessName: string;
  businessType: BusinessType;
  district: string;
  phone: string;
  whatsapp: string;
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
