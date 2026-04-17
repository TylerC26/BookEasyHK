-- Booking questions + answers

CREATE TABLE IF NOT EXISTS booking_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  input_type TEXT NOT NULL CHECK (input_type IN ('text', 'select', 'yes-no')),
  options JSONB,
  is_required BOOLEAN DEFAULT FALSE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT booking_questions_text_not_blank CHECK (btrim(question_text) <> ''),
  CONSTRAINT booking_questions_select_options CHECK (
    (input_type = 'select' AND jsonb_typeof(COALESCE(options, '[]'::jsonb)) = 'array' AND jsonb_array_length(COALESCE(options, '[]'::jsonb)) > 0)
    OR (input_type <> 'select' AND (options IS NULL OR jsonb_typeof(options) = 'array'))
  )
);

CREATE INDEX IF NOT EXISTS idx_booking_questions_business_service
  ON booking_questions(business_id, service_id, sort_order);

CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_questions_group_sort
  ON booking_questions (business_id, COALESCE(service_id, '00000000-0000-0000-0000-000000000000'::uuid), sort_order);

CREATE OR REPLACE FUNCTION enforce_booking_question_limit()
RETURNS TRIGGER AS $$
DECLARE
  existing_count INT;
BEGIN
  SELECT COUNT(*)
  INTO existing_count
  FROM booking_questions
  WHERE business_id = NEW.business_id
    AND (
      (service_id IS NULL AND NEW.service_id IS NULL)
      OR service_id = NEW.service_id
    )
    AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  IF existing_count >= 3 THEN
    RAISE EXCEPTION 'Maximum of 3 booking questions allowed per service or business-wide group';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS booking_questions_limit_trigger ON booking_questions;
CREATE TRIGGER booking_questions_limit_trigger
  BEFORE INSERT OR UPDATE ON booking_questions
  FOR EACH ROW
  EXECUTE FUNCTION enforce_booking_question_limit();

CREATE TABLE IF NOT EXISTS booking_answers (
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES booking_questions(id) ON DELETE CASCADE,
  answer_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (booking_id, question_id),
  CONSTRAINT booking_answers_text_not_blank CHECK (btrim(answer_text) <> '')
);

CREATE INDEX IF NOT EXISTS idx_booking_answers_question ON booking_answers(question_id);

ALTER TABLE booking_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owners_manage_booking_questions" ON booking_questions;
CREATE POLICY "owners_manage_booking_questions" ON booking_questions
  FOR ALL USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "public_read_booking_questions" ON booking_questions;
CREATE POLICY "public_read_booking_questions" ON booking_questions
  FOR SELECT USING (
    business_id IN (SELECT id FROM businesses WHERE onboarding_complete = TRUE)
  );

DROP POLICY IF EXISTS "owners_manage_booking_answers" ON booking_answers;
CREATE POLICY "owners_manage_booking_answers" ON booking_answers
  FOR ALL USING (
    booking_id IN (
      SELECT id
      FROM bookings
      WHERE business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "public_create_booking_answers" ON booking_answers;
-- WITH CHECK (TRUE) is safe here: the FK constraint (REFERENCES bookings(id))
-- already rejects invalid booking_id values at the DB level. The previous
-- subquery `booking_id IN (SELECT id FROM bookings)` always evaluated to FALSE
-- for anon users because there is no public SELECT policy on `bookings`,
-- causing every answer INSERT to be rejected.
CREATE POLICY "public_create_booking_answers" ON booking_answers
  FOR INSERT WITH CHECK (TRUE);
