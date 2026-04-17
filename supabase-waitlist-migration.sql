-- Apply this to an existing database to enable the waitlist feature.
-- It creates the waitlist table, indexes, RLS policies, and helper RPC.

CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  slot_datetime TIMESTAMPTZ NOT NULL,
  customer_name TEXT NOT NULL,
  customer_whatsapp TEXT NOT NULL,
  position INT NOT NULL CHECK (position > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'notified', 'expired', 'booked')),
  notified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_slot_status_position
  ON waitlist (business_id, slot_datetime, status, position);

CREATE INDEX IF NOT EXISTS idx_waitlist_expiry
  ON waitlist (status, expires_at);

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'waitlist'
      AND policyname = 'owners_manage_waitlist'
  ) THEN
    CREATE POLICY "owners_manage_waitlist" ON waitlist
      FOR ALL USING (
        business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION get_waitlist_position(
  p_business_id UUID,
  p_slot_datetime TIMESTAMPTZ
) RETURNS INT AS $$
DECLARE
  next_position INT;
BEGIN
  SELECT COALESCE(MAX(position), 0) + 1
  INTO next_position
  FROM waitlist
  WHERE business_id = p_business_id
    AND slot_datetime = p_slot_datetime
    AND status IN ('pending', 'notified');

  RETURN next_position;
END;
$$ LANGUAGE plpgsql;
