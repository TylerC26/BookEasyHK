-- Apply this to an existing database that was created before pending bookings existed.
-- It updates the bookings.status column to allow the new 'pending' state.

DO $$
DECLARE
  existing_constraint_name text;
BEGIN
  SELECT conname
  INTO existing_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'bookings'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status IN%';

  IF existing_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE bookings DROP CONSTRAINT %I', existing_constraint_name);
  END IF;
END $$;

ALTER TABLE bookings
  ALTER COLUMN status SET DEFAULT 'pending';

ALTER TABLE bookings
  ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('pending', 'confirmed', 'completed', 'no_show', 'cancelled'));
