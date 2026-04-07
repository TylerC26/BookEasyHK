-- BookEasy HK - Database Schema
-- Run this in the Supabase SQL Editor to set up your database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- BUSINESSES
-- ============================================
CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('nail', 'hair', 'carwash', 'pet', 'massage', 'beauty', 'other')),
  district TEXT,
  address_text TEXT,
  address_map_link TEXT,
  phone TEXT,
  whatsapp TEXT,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  business_image_url TEXT,
  social_links JSONB,
  buffer_minutes INT DEFAULT 0,
  min_advance_hours INT DEFAULT 2,
  max_advance_days INT DEFAULT 30,
  language TEXT DEFAULT 'zh-HK',
  onboarding_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_businesses_slug ON businesses(slug);
CREATE INDEX idx_businesses_owner ON businesses(owner_id);

-- ============================================
-- SERVICES
-- ============================================
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_zh TEXT,
  duration_minutes INT NOT NULL CHECK (duration_minutes > 0),
  price_hkd DECIMAL(10,2) CHECK (price_hkd >= 0),
  active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_services_business ON services(business_id);

-- ============================================
-- WORKING HOURS
-- ============================================
CREATE TABLE working_hours (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_open BOOLEAN DEFAULT TRUE,
  open_time TIME,
  close_time TIME,
  break_start TIME,
  break_end TIME,
  UNIQUE(business_id, day_of_week)
);

CREATE INDEX idx_working_hours_business ON working_hours(business_id);

-- ============================================
-- BOOKINGS
-- ============================================
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id),
  price_hkd DECIMAL(10,2) CHECK (price_hkd >= 0),
  owner_notes TEXT,
  owner_image_url TEXT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_whatsapp TEXT,
  customer_email TEXT,
  customer_notes TEXT,
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'no_show', 'cancelled')),
  is_manual BOOLEAN DEFAULT FALSE,
  reminder_24h_sent BOOLEAN DEFAULT FALSE,
  reminder_2h_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bookings_business_date ON bookings(business_id, booking_date);
CREATE INDEX idx_bookings_status ON bookings(status);

-- ============================================
-- BLOCKED TIMES
-- ============================================
CREATE TABLE blocked_times (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  blocked_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_blocked_times_business_date ON blocked_times(business_id, blocked_date);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE working_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_times ENABLE ROW LEVEL SECURITY;

-- Businesses: owners can CRUD their own
CREATE POLICY "owners_manage_business" ON businesses
  FOR ALL USING (auth.uid() = owner_id);

-- Public can read businesses by slug (for booking page)
CREATE POLICY "public_read_business" ON businesses
  FOR SELECT USING (onboarding_complete = TRUE);

-- Services: owners manage, public reads active ones
CREATE POLICY "owners_manage_services" ON services
  FOR ALL USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

CREATE POLICY "public_read_services" ON services
  FOR SELECT USING (active = TRUE);

-- Working hours: owners manage, public reads
CREATE POLICY "owners_manage_hours" ON working_hours
  FOR ALL USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

CREATE POLICY "public_read_hours" ON working_hours
  FOR SELECT USING (TRUE);

-- Bookings: owners manage their bookings, public can insert
CREATE POLICY "owners_manage_bookings" ON bookings
  FOR ALL USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

CREATE POLICY "public_create_booking" ON bookings
  FOR INSERT WITH CHECK (TRUE);

-- Blocked times: owners manage, public reads
CREATE POLICY "owners_manage_blocked" ON blocked_times
  FOR ALL USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

CREATE POLICY "public_read_blocked" ON blocked_times
  FOR SELECT USING (TRUE);

-- Storage bucket for owner note images
INSERT INTO storage.buckets (id, name, public)
VALUES ('booking-owner-notes', 'booking-owner-notes', true)
ON CONFLICT (id) DO NOTHING;

-- Storage bucket for business logos and storefront images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'business-images',
  'business-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "public_read_business_images" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'business-images');

CREATE POLICY "owners_upload_business_images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'business-images'
    AND auth.uid()::text = split_part(name, '/', 1)
  );

CREATE POLICY "owners_update_business_images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'business-images'
    AND auth.uid()::text = split_part(name, '/', 1)
  )
  WITH CHECK (
    bucket_id = 'business-images'
    AND auth.uid()::text = split_part(name, '/', 1)
  );

CREATE POLICY "owners_delete_business_images" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'business-images'
    AND auth.uid()::text = split_part(name, '/', 1)
  );

CREATE POLICY "owners_upload_booking_note_images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'booking-owner-notes'
    AND EXISTS (
      SELECT 1
      FROM businesses
      WHERE businesses.id::text = split_part(name, '/', 1)
        AND businesses.owner_id = auth.uid()
    )
  );

CREATE POLICY "owners_update_booking_note_images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'booking-owner-notes'
    AND EXISTS (
      SELECT 1
      FROM businesses
      WHERE businesses.id::text = split_part(name, '/', 1)
        AND businesses.owner_id = auth.uid()
    )
  );

CREATE POLICY "owners_delete_booking_note_images" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'booking-owner-notes'
    AND EXISTS (
      SELECT 1
      FROM businesses
      WHERE businesses.id::text = split_part(name, '/', 1)
        AND businesses.owner_id = auth.uid()
    )
  );

-- ============================================
-- FUNCTIONS
-- ============================================

-- Check for overlapping bookings (double-booking prevention)
CREATE OR REPLACE FUNCTION check_booking_overlap(
  p_business_id UUID,
  p_booking_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_exclude_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM bookings
    WHERE business_id = p_business_id
      AND booking_date = p_booking_date
      AND status NOT IN ('cancelled')
      AND (p_exclude_id IS NULL OR id != p_exclude_id)
      AND start_time < p_end_time
      AND end_time > p_start_time
  );
END;
$$ LANGUAGE plpgsql;

-- Check for blocked time overlap
CREATE OR REPLACE FUNCTION check_blocked_overlap(
  p_business_id UUID,
  p_date DATE,
  p_start_time TIME,
  p_end_time TIME
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM blocked_times
    WHERE business_id = p_business_id
      AND blocked_date = p_date
      AND start_time < p_end_time
      AND end_time > p_start_time
  );
END;
$$ LANGUAGE plpgsql;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER businesses_updated_at
  BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
