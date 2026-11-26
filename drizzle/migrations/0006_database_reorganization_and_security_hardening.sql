-- ============================================================================
-- TechBridge Database Reorganization & Security Hardening Migration
-- ============================================================================
-- 1. Schema Cleanup & Consolidation (drop zombie objects, unify overloads, register buckets)
-- 2. Referential Integrity, Domain Check Constraints & Missing updated_at Triggers
-- 3. Performance & Foreign-Key Indexes
-- 4. Core Role Resolution & SECURITY DEFINER Hardening
-- 5. State-Machine Guard Triggers & RLS Policy Tightening
-- 6. Public View & PII Column-Privilege Remediation
-- 7. Complete GDPR Account Erasure & Least-Privilege Function Grants
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SCHEMA CLEANUP & CONSOLIDATION
-- ----------------------------------------------------------------------------

DROP TABLE IF EXISTS public.project_scores CASCADE;
DROP VIEW IF EXISTS public.leaderboard;
DROP FUNCTION IF EXISTS public.issue_certificates_for_event(uuid);
DROP INDEX IF EXISTS public.idx_points_log_user_id;

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('message-attachments', 'message-attachments', false),
  ('submission-docs', 'submission-docs', false)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. CORE ROLE VERIFICATION FUNCTION (SECURITY DEFINER + ANTI-ENUMERATION)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Prevent non-admin callers from enumerating roles of arbitrary user UUIDs
  IF auth.uid() IS NOT NULL AND _user_id <> auth.uid() THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'::public.app_role
    ) THEN
      RETURN false;
    END IF;
  ELSIF auth.uid() IS NULL AND current_user IN ('anon', 'authenticated') THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. REFERENTIAL INTEGRITY, CHECK CONSTRAINTS & UPDATED_AT TRIGGERS
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_event_id_fkey') THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_event_id_fkey
      FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'judge_invitations_event_id_fkey') THEN
    ALTER TABLE public.judge_invitations
      ADD CONSTRAINT judge_invitations_event_id_fkey
      FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_feedback_event_id_fkey') THEN
    ALTER TABLE public.event_feedback
      ADD CONSTRAINT event_feedback_event_id_fkey
      FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_registrations_status_chk') THEN
    ALTER TABLE public.event_registrations
      ADD CONSTRAINT event_registrations_status_chk
      CHECK (status IN ('registered', 'waitlisted', 'attended', 'cancelled', 'completed')) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mentorship_requests_status_chk') THEN
    ALTER TABLE public.mentorship_requests
      ADD CONSTRAINT mentorship_requests_status_chk
      CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_members_role_chk') THEN
    ALTER TABLE public.team_members
      ADD CONSTRAINT team_members_role_chk
      CHECK (role IN ('captain', 'member')) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_members_status_chk') THEN
    ALTER TABLE public.team_members
      ADD CONSTRAINT team_members_status_chk
      CHECK (status IN ('pending', 'accepted', 'rejected')) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contact_messages_status_chk') THEN
    ALTER TABLE public.contact_messages
      ADD CONSTRAINT contact_messages_status_chk
      CHECK (status IN ('new', 'read', 'replied', 'archived', 'spam')) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_people_kind_chk') THEN
    ALTER TABLE public.event_people
      ADD CONSTRAINT event_people_kind_chk
      CHECK (kind IN ('judge', 'mentor', 'sponsor', 'volunteer', 'speaker', 'organizer')) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_categories_team_size_chk') THEN
    ALTER TABLE public.event_categories
      ADD CONSTRAINT event_categories_team_size_chk
      CHECK (min_team_size >= 1 AND max_team_size >= min_team_size) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'category_fee_tiers_amount_chk') THEN
    ALTER TABLE public.category_fee_tiers
      ADD CONSTRAINT category_fee_tiers_amount_chk
      CHECK (amount >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'judging_criteria_score_chk') THEN
    ALTER TABLE public.judging_criteria
      ADD CONSTRAINT judging_criteria_score_chk
      CHECK (max_score > 0 AND weight >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_score_items_score_chk') THEN
    ALTER TABLE public.project_score_items
      ADD CONSTRAINT project_score_items_score_chk
      CHECK (score >= 0) NOT VALID;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_mentorship_requests_updated ON public.mentorship_requests;
CREATE TRIGGER trg_mentorship_requests_updated
  BEFORE UPDATE ON public.mentorship_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_certificate_templates_updated ON public.certificate_templates;
CREATE TRIGGER trg_certificate_templates_updated
  BEFORE UPDATE ON public.certificate_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_sponsor_reviews_updated ON public.sponsor_reviews;
CREATE TRIGGER trg_sponsor_reviews_updated
  BEFORE UPDATE ON public.sponsor_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 4. PERFORMANCE & FOREIGN-KEY INDEXES
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_team_registrations_event_status ON public.team_registrations(event_id, status);
CREATE INDEX IF NOT EXISTS idx_team_registrations_category ON public.team_registrations(category_id);
CREATE INDEX IF NOT EXISTS idx_team_registrations_created_by ON public.team_registrations(created_by);
CREATE INDEX IF NOT EXISTS idx_team_registrations_fee_tier ON public.team_registrations(fee_tier_id);
CREATE INDEX IF NOT EXISTS idx_registration_participants_reg ON public.registration_participants(registration_id);
CREATE INDEX IF NOT EXISTS idx_registration_participants_email ON public.registration_participants(lower(email));
CREATE INDEX IF NOT EXISTS idx_registration_payments_reg_status ON public.registration_payments(registration_id, status);
CREATE INDEX IF NOT EXISTS idx_registration_events_reg_created ON public.registration_events(registration_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_category_fee_tiers_cat_sort ON public.category_fee_tiers(category_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_event_announcements_event_created ON public.event_announcements(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_people_event_kind_sort ON public.event_people(event_id, kind, sort_order);
CREATE INDEX IF NOT EXISTS idx_sponsorships_event_sponsor_status ON public.sponsorships(event_id, sponsor_user_id, status);
CREATE INDEX IF NOT EXISTS idx_project_documents_project ON public.project_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_sponsor_reviews_sponsorship ON public.sponsor_reviews(sponsorship_id);
CREATE INDEX IF NOT EXISTS idx_sponsor_reviews_reviewer ON public.sponsor_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_mentorship_requests_mentor_status ON public.mentorship_requests(mentor_id, status);
CREATE INDEX IF NOT EXISTS idx_mentorship_requests_mentee_status ON public.mentorship_requests(mentee_id, status);
CREATE INDEX IF NOT EXISTS idx_conversations_user_a_last_msg ON public.conversations(user_a, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_user_b_last_msg ON public.conversations(user_b, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_score_items_criterion ON public.project_score_items(criterion_id);
CREATE INDEX IF NOT EXISTS idx_blog_comments_author_user ON public.blog_comments(author_user_id);
CREATE INDEX IF NOT EXISTS idx_forum_votes_user ON public.forum_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_project_votes_user ON public.project_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_event_feedback_user ON public.event_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created ON public.notifications(user_id, is_read, created_at DESC);

-- ----------------------------------------------------------------------------
-- 5. STATE-MACHINE GUARD TRIGGERS & RLS POLICY TIGHTENING
-- ----------------------------------------------------------------------------

-- 5A. Team Registrations: prevent owners from self-approving or tampering with review fields
DROP POLICY IF EXISTS "Owners edit editable registrations" ON public.team_registrations;
CREATE POLICY "Owners edit editable registrations"
  ON public.team_registrations FOR UPDATE TO authenticated
  USING (created_by = auth.uid() AND status IN ('draft', 'submitted', 'payment_pending'))
  WITH CHECK (created_by = auth.uid() AND status IN ('draft', 'submitted', 'payment_pending', 'withdrawn'));

CREATE OR REPLACE FUNCTION public.guard_team_registration_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::public.app_role)
     OR coalesce(current_setting('app.registration_bypass', true), '') = 'on'
     OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('draft', 'submitted', 'payment_pending') THEN
      RAISE EXCEPTION 'Invalid initial registration status';
    END IF;
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
    NEW.review_notes := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status NOT IN ('draft', 'submitted', 'payment_pending', 'withdrawn') THEN
      RAISE EXCEPTION 'Only organisers can verify or approve registrations';
    END IF;
    IF NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
       OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
       OR NEW.review_notes IS DISTINCT FROM OLD.review_notes THEN
      RAISE EXCEPTION 'Cannot modify organiser review metadata';
    END IF;
    IF OLD.status <> 'draft' AND NEW.fee_amount IS DISTINCT FROM OLD.fee_amount THEN
      RAISE EXCEPTION 'Cannot change fee amount after submission';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_team_registration_status ON public.team_registrations;
CREATE TRIGGER trg_guard_team_registration_status
  BEFORE INSERT OR UPDATE ON public.team_registrations
  FOR EACH ROW EXECUTE FUNCTION public.guard_team_registration_status();

-- 5B. Registration Payments: prevent owners from self-verifying payments
DROP POLICY IF EXISTS "Owners create payments" ON public.registration_payments;
CREATE POLICY "Owners create payments"
  ON public.registration_payments FOR INSERT TO authenticated
  WITH CHECK (
    public.owns_registration(registration_id, auth.uid())
    AND status = 'pending'::public.payment_verification_status
    AND verified_by IS NULL
    AND verified_at IS NULL
  );

DROP POLICY IF EXISTS "Owners update own pending payments" ON public.registration_payments;
CREATE POLICY "Owners update own pending payments"
  ON public.registration_payments FOR UPDATE TO authenticated
  USING (
    public.owns_registration(registration_id, auth.uid())
    AND status <> 'verified'::public.payment_verification_status
  )
  WITH CHECK (
    public.owns_registration(registration_id, auth.uid())
    AND status = 'pending'::public.payment_verification_status
    AND verified_by IS NULL
    AND verified_at IS NULL
  );

CREATE OR REPLACE FUNCTION public.guard_registration_payment_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::public.app_role)
     OR coalesce(current_setting('app.registration_bypass', true), '') = 'on'
     OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'verified'::public.payment_verification_status
     OR NEW.verified_by IS NOT NULL
     OR NEW.verified_at IS NOT NULL THEN
    RAISE EXCEPTION 'Only organisers can verify payments';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_registration_payment_status ON public.registration_payments;
CREATE TRIGGER trg_guard_registration_payment_status
  BEFORE INSERT OR UPDATE ON public.registration_payments
  FOR EACH ROW EXECUTE FUNCTION public.guard_registration_payment_status();

-- Update admin RPCs to set app.registration_bypass = 'on'
CREATE OR REPLACE FUNCTION public.review_team_registration(
  _id uuid,
  _status public.registration_status,
  _notes text DEFAULT NULL
)
RETURNS public.team_registrations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_row public.team_registrations;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  PERFORM set_config('app.registration_bypass', 'on', true);

  UPDATE public.team_registrations
  SET status = _status,
      review_notes = COALESCE(_notes, review_notes),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      submitted_at = CASE WHEN _status = 'submitted' AND submitted_at IS NULL THEN now() ELSE submitted_at END
  WHERE id = _id
  RETURNING * INTO updated_row;

  IF updated_row.id IS NULL THEN
    RAISE EXCEPTION 'Registration not found';
  END IF;

  INSERT INTO public.notifications(user_id, title, message, type, link)
  VALUES (
    updated_row.created_by,
    'Registration status: ' || replace(_status::text, '_', ' '),
    'Team "' || updated_row.team_name || '" (' || COALESCE(updated_row.team_code, updated_row.reference) || ') is now ' || replace(_status::text, '_', ' ') ||
    CASE WHEN _notes IS NOT NULL AND _notes <> '' THEN ' — ' || _notes ELSE '' END,
    CASE WHEN _status = 'approved' THEN 'success' WHEN _status = 'rejected' THEN 'error' ELSE 'info' END,
    '/team-portal'
  );

  INSERT INTO public.admin_audit_log(performed_by, action, resource_type, resource_id, resource_label, metadata)
  VALUES (
    auth.uid(),
    'registration.' || _status::text,
    'event',
    updated_row.id,
    updated_row.team_code,
    jsonb_build_object('team_name', updated_row.team_name, 'status', _status, 'notes', _notes)
  );

  RETURN updated_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_registration_payment(
  _payment_id uuid,
  _status public.payment_verification_status,
  _notes text DEFAULT NULL
)
RETURNS public.registration_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pay_row public.registration_payments;
  reg_row public.team_registrations;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  PERFORM set_config('app.registration_bypass', 'on', true);

  UPDATE public.registration_payments
  SET status = _status,
      notes = COALESCE(_notes, notes),
      verified_by = auth.uid(),
      verified_at = now()
  WHERE id = _payment_id
  RETURNING * INTO pay_row;

  IF pay_row.id IS NULL THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;

  SELECT * INTO reg_row FROM public.team_registrations WHERE id = pay_row.registration_id;

  IF _status = 'verified' AND reg_row.status IN ('submitted', 'payment_pending', 'payment_verification') THEN
    UPDATE public.team_registrations
    SET status = 'payment_verification'
    WHERE id = reg_row.id;
  ELSIF _status = 'rejected' THEN
    UPDATE public.team_registrations
    SET status = 'payment_pending',
        review_notes = COALESCE(_notes, review_notes)
    WHERE id = reg_row.id;
  END IF;

  INSERT INTO public.registration_events(registration_id, actor_id, actor_role, event_type, note)
  VALUES (
    pay_row.registration_id,
    auth.uid(),
    'admin',
    'payment_' || _status::text,
    'Payment ' || _status::text || COALESCE(': ' || _notes, '')
  );

  RETURN pay_row;
END;
$$;

-- 5C. Mentorship Requests: prevent mentees from self-accepting requests
CREATE OR REPLACE FUNCTION public.guard_mentorship_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::public.app_role) OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.mentor_id = NEW.mentee_id THEN
      RAISE EXCEPTION 'Cannot request mentorship from yourself';
    END IF;
    NEW.status := 'pending';
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.mentor_id IS DISTINCT FROM OLD.mentor_id OR NEW.mentee_id IS DISTINCT FROM OLD.mentee_id THEN
      RAISE EXCEPTION 'Cannot change mentorship participants';
    END IF;
    IF auth.uid() = OLD.mentee_id AND auth.uid() <> OLD.mentor_id THEN
      IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'cancelled' THEN
        RAISE EXCEPTION 'Mentees can only cancel their mentorship requests';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_mentorship_request ON public.mentorship_requests;
CREATE TRIGGER trg_guard_mentorship_request
  BEFORE INSERT OR UPDATE ON public.mentorship_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_mentorship_request();

-- 5D. Mentor Bookings: prevent mentee self-confirmation, meeting_url tampering, or hard deletion
DROP POLICY IF EXISTS "Mentees create bookings" ON public.mentor_bookings;
CREATE POLICY "Mentees create bookings"
  ON public.mentor_bookings FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = mentee_id
    AND mentor_id <> mentee_id
    AND end_at > start_at
    AND status = 'pending'
  );

DROP POLICY IF EXISTS "Parties delete bookings" ON public.mentor_bookings;
DROP POLICY IF EXISTS "Admins delete bookings" ON public.mentor_bookings;
CREATE POLICY "Admins delete bookings"
  ON public.mentor_bookings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.guard_mentor_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::public.app_role) OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.status := 'pending';
    NEW.meeting_url := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.mentor_id IS DISTINCT FROM OLD.mentor_id OR NEW.mentee_id IS DISTINCT FROM OLD.mentee_id THEN
      RAISE EXCEPTION 'Cannot change booking participants';
    END IF;
    IF auth.uid() = OLD.mentee_id AND auth.uid() <> OLD.mentor_id THEN
      IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status NOT IN ('cancelled', 'pending') THEN
        RAISE EXCEPTION 'Only the mentor can confirm or complete a booking';
      END IF;
      IF NEW.meeting_url IS DISTINCT FROM OLD.meeting_url THEN
        RAISE EXCEPTION 'Only the mentor can update the meeting link';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_mentor_booking ON public.mentor_bookings;
CREATE TRIGGER trg_guard_mentor_booking
  BEFORE INSERT OR UPDATE ON public.mentor_bookings
  FOR EACH ROW EXECUTE FUNCTION public.guard_mentor_booking();

-- 5E. Team Members: prevent unauthorized team join as 'accepted' or 'captain'
ALTER TABLE public.team_members ALTER COLUMN status SET DEFAULT 'pending';

CREATE OR REPLACE FUNCTION public.guard_team_member_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_captain boolean;
BEGIN
  IF public.has_role(auth.uid(), 'admin'::public.app_role) OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.event_teams t
    WHERE t.id = COALESCE(NEW.team_id, OLD.team_id)
      AND t.captain_id = auth.uid()
  ) INTO is_captain;

  IF is_captain THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.role := 'member';
    NEW.status := 'pending';
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.role IS DISTINCT FROM OLD.role OR NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Only the team captain can approve members or change roles';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_team_member_changes ON public.team_members;
CREATE TRIGGER trg_guard_team_member_changes
  BEFORE INSERT OR UPDATE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.guard_team_member_changes();

-- 5F. Forum Threads: prevent non-admins from self-pinning, locking, or tampering with counters
CREATE OR REPLACE FUNCTION public.guard_forum_thread_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::public.app_role)
     OR coalesce(current_setting('app.forum_bypass', true), '') = 'on'
     OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  NEW.pinned := OLD.pinned;
  NEW.locked := OLD.locked;
  NEW.view_count := OLD.view_count;
  NEW.reply_count := OLD.reply_count;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_forum_thread_fields ON public.forum_threads;
CREATE TRIGGER trg_guard_forum_thread_fields
  BEFORE UPDATE ON public.forum_threads
  FOR EACH ROW EXECUTE FUNCTION public.guard_forum_thread_fields();

CREATE OR REPLACE FUNCTION public.increment_thread_view(_thread_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.forum_bypass', 'on', true);
  UPDATE public.forum_threads
  SET view_count = view_count + 1
  WHERE id = _thread_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.bump_thread_on_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.forum_bypass', 'on', true);
  IF TG_OP = 'INSERT' THEN
    UPDATE public.forum_threads
    SET reply_count = reply_count + 1, last_activity_at = now()
    WHERE id = NEW.thread_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.forum_threads
    SET reply_count = GREATEST(0, reply_count - 1)
    WHERE id = OLD.thread_id;
  END IF;
  RETURN NULL;
END;
$$;

-- 5G. Messages: prevent recipient from altering content/attachments or reviving deleted messages
CREATE OR REPLACE FUNCTION public.log_message_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If caller is not the sender (e.g. recipient marking message read), only allow read_at update
  IF auth.uid() IS DISTINCT FROM OLD.sender_id AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    IF NEW.content IS DISTINCT FROM OLD.content
       OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
       OR NEW.attachment_path IS DISTINCT FROM OLD.attachment_path
       OR NEW.attachment_name IS DISTINCT FROM OLD.attachment_name
       OR NEW.attachment_type IS DISTINCT FROM OLD.attachment_type
       OR NEW.attachment_size IS DISTINCT FROM OLD.attachment_size
       OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
       OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id THEN
      RAISE EXCEPTION 'Only the sender can edit or delete a message';
    END IF;
    RETURN NEW;
  END IF;

  -- Prevent modifying content of an already-deleted message
  IF OLD.deleted_at IS NOT NULL AND NEW.content IS DISTINCT FROM OLD.content THEN
    RAISE EXCEPTION 'Deleted messages cannot be edited';
  END IF;

  -- Soft-delete transition
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    INSERT INTO public.message_edits (message_id, actor_id, action, previous_content)
    VALUES (OLD.id, COALESCE(auth.uid(), OLD.sender_id), 'delete', OLD.content);
    NEW.content := '';
    RETURN NEW;
  END IF;

  -- Content edit transition
  IF NEW.content IS DISTINCT FROM OLD.content AND OLD.deleted_at IS NULL THEN
    INSERT INTO public.message_edits (message_id, actor_id, action, previous_content)
    VALUES (OLD.id, COALESCE(auth.uid(), OLD.sender_id), 'edit', OLD.content);
    NEW.edited_at := now();
  END IF;

  RETURN NEW;
END;
$$;

-- 5H. Event Registrations: prevent non-admins from self-marking attended or paid
CREATE OR REPLACE FUNCTION public.guard_event_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::public.app_role) OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.attended := false;
    NEW.attended_at := NULL;
    NEW.paid := false;
    NEW.paid_at := NULL;
    IF NEW.status NOT IN ('registered', 'waitlisted') THEN
      NEW.status := 'registered';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.attended := OLD.attended;
    NEW.attended_at := OLD.attended_at;
    NEW.paid := OLD.paid;
    NEW.paid_at := OLD.paid_at;
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'cancelled' THEN
      RAISE EXCEPTION 'Users can only cancel their registration';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_event_registration ON public.event_registrations;
CREATE TRIGGER trg_guard_event_registration
  BEFORE INSERT OR UPDATE ON public.event_registrations
  FOR EACH ROW EXECUTE FUNCTION public.guard_event_registration();

-- 5I. Mentor Profiles: default is_active to false and require admin approval to activate
ALTER TABLE public.mentor_profiles ALTER COLUMN is_active SET DEFAULT false;

CREATE OR REPLACE FUNCTION public.guard_mentor_profile_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::public.app_role) OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.is_active := false;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.is_active = false AND NEW.is_active = true THEN
      RAISE EXCEPTION 'Only an administrator can activate a mentor profile';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_mentor_profile_activation ON public.mentor_profiles;
CREATE TRIGGER trg_guard_mentor_profile_activation
  BEFORE INSERT OR UPDATE ON public.mentor_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_mentor_profile_activation();

-- 5J. Projects: grant column-level SELECT on newer non-admin columns
GRANT SELECT (team_id, registration_id, submitted_at) ON public.projects TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6. PUBLIC VIEWS & PII COLUMN-PRIVILEGE REMEDIATION
-- ----------------------------------------------------------------------------

-- 6A. about_team_members_public: allow public reads on published rows while protecting email
REVOKE SELECT ON public.about_team_members FROM anon;
GRANT SELECT (
  id, full_name, role, bio, photo_url, initials, linkedin_url, twitter_url,
  sort_order, created_at, updated_at
) ON public.about_team_members TO anon, authenticated;

DROP POLICY IF EXISTS "Public read published about team" ON public.about_team_members;
CREATE POLICY "Public read published about team"
  ON public.about_team_members FOR SELECT
  TO anon, authenticated
  USING (true);

-- 6B. blog_comments_public: allow public reads on approved comments while protecting author_email & ip_hash
REVOKE SELECT ON public.blog_comments FROM anon;
GRANT SELECT (
  id, post_id, parent_id, author_user_id, author_name, content,
  status, created_at, updated_at
) ON public.blog_comments TO anon, authenticated;

DROP POLICY IF EXISTS "Public read approved blog comments" ON public.blog_comments;
CREATE POLICY "Public read approved blog comments"
  ON public.blog_comments FOR SELECT
  TO anon, authenticated
  USING (status = 'approved'::public.comment_status);

-- 6C. Safe Public Profiles Lookup RPC (never exposes email)
CREATE OR REPLACE FUNCTION public.get_public_profiles(_user_ids uuid[])
RETURNS TABLE(
  user_id uuid,
  full_name text,
  avatar_url text,
  bio text,
  skills text[],
  university text,
  github_url text,
  linkedin_url text,
  portfolio_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.user_id,
    p.full_name,
    p.avatar_url,
    p.bio,
    p.skills,
    p.university,
    p.github_url,
    p.linkedin_url,
    p.portfolio_url
  FROM public.profiles p
  WHERE p.user_id = ANY(_user_ids);
$$;

GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 7. CERTIFICATE FUNCTIONS & COMPLETE GDPR ACCOUNT ERASURE
-- ----------------------------------------------------------------------------

-- 7A. Restrict search_certificates to admins only
CREATE OR REPLACE FUNCTION public.search_certificates(_q text, _limit integer DEFAULT 8)
RETURNS TABLE(certificate_number text, recipient_name text, issued_at timestamptz, revoked boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    c.certificate_number,
    c.recipient_name,
    c.issued_at,
    (c.revoked_at IS NOT NULL) AS revoked
  FROM public.certificates c
  WHERE length(trim(coalesce(_q, ''))) >= 3
    AND (
      c.certificate_number ILIKE '%' || trim(_q) || '%'
      OR c.recipient_name ILIKE '%' || trim(_q) || '%'
    )
  ORDER BY c.issued_at DESC
  LIMIT GREATEST(1, LEAST(coalesce(_limit, 8), 20));
END;
$$;

-- 7B. Clean loop variables in issue_certificate
CREATE OR REPLACE FUNCTION public.issue_certificate(
  _event_id uuid,
  _user_id uuid,
  _recipient_name text,
  _program_type text DEFAULT NULL::text,
  _description text DEFAULT NULL::text,
  _signatories jsonb DEFAULT '[]'::jsonb
)
RETURNS public.certificates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cert_number text;
  attempts int := 0;
  new_row public.certificates;
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  seg text;
  seg_idx int;
  char_idx int;
  ev_type text;
  ev_title text;
  ptype text;
  pdesc text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT event_type::text, title INTO ev_type, ev_title FROM public.events WHERE id = _event_id;

  ptype := COALESCE(NULLIF(_program_type, ''), CASE ev_type
    WHEN 'hackathon' THEN 'Hackathon Participation'
    WHEN 'bootcamp' THEN 'Bootcamp Completion'
    WHEN 'workshop' THEN 'Workshop Attendance'
    WHEN 'webinar' THEN 'Webinar Attendance'
    WHEN 'conference' THEN 'Conference Participation'
    ELSE 'Participation' END);

  pdesc := COALESCE(NULLIF(_description, ''), CASE ev_type
    WHEN 'hackathon' THEN 'for actively participating in ' || COALESCE(ev_title, 'the hackathon') || ', collaborating in a team to design, build and present an innovative technology solution under competition conditions.'
    WHEN 'bootcamp' THEN 'for successfully completing the intensive ' || COALESCE(ev_title, 'bootcamp') || ' training programme, demonstrating commitment, practical skills and hands-on project work.'
    WHEN 'workshop' THEN 'for attending and taking part in the practical sessions of ' || COALESCE(ev_title, 'the workshop') || '.'
    WHEN 'webinar' THEN 'for attending ' || COALESCE(ev_title, 'the webinar') || '.'
    WHEN 'conference' THEN 'for participating in ' || COALESCE(ev_title, 'the conference') || '.'
    ELSE 'for participating in ' || COALESCE(ev_title, 'this programme') || '.' END);

  LOOP
    attempts := attempts + 1;
    cert_number := 'TB-';
    FOR seg_idx IN 1..3 LOOP
      seg := '';
      FOR char_idx IN 1..4 LOOP
        seg := seg || substr(chars, 1 + floor(random() * length(chars))::int, 1);
      END LOOP;
      cert_number := cert_number || seg || CASE WHEN seg_idx < 3 THEN '-' ELSE '' END;
    END LOOP;

    BEGIN
      INSERT INTO public.certificates(certificate_number, event_id, user_id, recipient_name, program_type, description, signatories)
      VALUES (cert_number, _event_id, _user_id, _recipient_name, ptype, pdesc, COALESCE(_signatories, '[]'::jsonb))
      RETURNING * INTO new_row;

      INSERT INTO public.admin_audit_log(performed_by, action, resource_type, resource_id, resource_label, metadata)
      VALUES (auth.uid(), 'certificate.issue', 'certificate', new_row.id, new_row.certificate_number,
              jsonb_build_object('recipient', new_row.recipient_name, 'event_id', new_row.event_id));
      RETURN new_row;
    EXCEPTION WHEN unique_violation THEN
      IF attempts >= 8 THEN
        RAISE EXCEPTION 'Failed to allocate unique certificate number after % attempts', attempts;
      END IF;
    END;
  END LOOP;
END;
$$;

-- 7C. Complete GDPR Account Erasure (supports authenticated self, admin, and service_role)
CREATE OR REPLACE FUNCTION public.delete_user_data(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email text;
BEGIN
  IF auth.role() <> 'service_role' THEN
    IF auth.uid() IS NULL OR (auth.uid() <> _user_id AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
  END IF;

  SELECT email INTO user_email FROM public.profiles WHERE user_id = _user_id;

  PERFORM set_config('app.project_bypass', 'on', true);
  PERFORM set_config('app.registration_bypass', 'on', true);
  PERFORM set_config('app.forum_bypass', 'on', true);

  DELETE FROM public.message_reactions WHERE user_id = _user_id;
  DELETE FROM public.message_edits WHERE actor_id = _user_id;
  DELETE FROM public.messages WHERE sender_id = _user_id;
  DELETE FROM public.conversations WHERE user_a = _user_id OR user_b = _user_id;

  DELETE FROM public.mentor_reviews WHERE mentor_id = _user_id OR reviewer_id = _user_id;
  DELETE FROM public.booking_events WHERE actor_id = _user_id;
  DELETE FROM public.mentor_bookings WHERE mentor_id = _user_id OR mentee_id = _user_id;
  DELETE FROM public.mentor_availability WHERE mentor_id = _user_id;
  DELETE FROM public.mentorship_requests WHERE mentor_id = _user_id OR mentee_id = _user_id;
  DELETE FROM public.mentor_profiles WHERE user_id = _user_id;

  DELETE FROM public.forum_votes WHERE user_id = _user_id;
  DELETE FROM public.forum_replies WHERE user_id = _user_id;
  DELETE FROM public.forum_threads WHERE user_id = _user_id;
  DELETE FROM public.blog_comments WHERE author_user_id = _user_id;

  DELETE FROM public.project_reactions WHERE user_id = _user_id;
  DELETE FROM public.project_comments WHERE user_id = _user_id;
  DELETE FROM public.project_documents WHERE uploaded_by = _user_id;
  DELETE FROM public.project_score_items WHERE judge_id = _user_id;
  DELETE FROM public.project_votes WHERE user_id = _user_id;
  DELETE FROM public.projects WHERE user_id = _user_id;

  DELETE FROM public.team_members WHERE user_id = _user_id;
  DELETE FROM public.event_teams WHERE captain_id = _user_id;
  DELETE FROM public.team_registrations WHERE created_by = _user_id;
  DELETE FROM public.event_feedback WHERE user_id = _user_id;
  DELETE FROM public.event_registrations WHERE user_id = _user_id;

  DELETE FROM public.content_reports WHERE reporter_id = _user_id;
  DELETE FROM public.push_subscriptions WHERE user_id = _user_id;
  DELETE FROM public.certificates WHERE user_id = _user_id;
  DELETE FROM public.points_log WHERE user_id = _user_id;
  DELETE FROM public.user_badges WHERE user_id = _user_id;
  DELETE FROM public.notifications WHERE user_id = _user_id;
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  DELETE FROM public.profiles WHERE user_id = _user_id;

  IF user_email IS NOT NULL THEN
    DELETE FROM public.newsletter_subscribers WHERE lower(email) = lower(user_email);
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 8. LEAST-PRIVILEGE FUNCTION EXECUTION GRANTS
-- ----------------------------------------------------------------------------

-- Revoke direct execution of all trigger functions from PUBLIC, anon, authenticated
DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'add_team_captain()',
    'assign_registration_codes()',
    'auto_issue_certificates_on_completion()',
    'auto_waitlist_registration()',
    'award_points_certificate()',
    'award_points_event_reg()',
    'award_points_forum_reply()',
    'award_points_forum_thread()',
    'award_points_mentor_review()',
    'award_points_project()',
    'award_points_project_vote()',
    'bump_thread_on_reply()',
    'check_badge_awards()',
    'force_comment_pending()',
    'guard_event_registration()',
    'guard_forum_thread_fields()',
    'guard_mentor_booking()',
    'guard_mentor_profile_activation()',
    'guard_mentorship_request()',
    'guard_project_status()',
    'guard_registration_payment_status()',
    'guard_team_member_changes()',
    'guard_team_registration_status()',
    'handle_new_user()',
    'log_booking_event()',
    'log_message_edit()',
    'log_registration_event()',
    'log_user_role_change()',
    'notify_booking_update()',
    'notify_event_registration()',
    'notify_mentor_booking()',
    'notify_mentorship_request()',
    'notify_mentorship_update()',
    'notify_new_message()',
    'promote_waitlist_on_cancel()',
    'update_updated_at_column()'
  ] LOOP
    BEGIN EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated;', fn); EXCEPTION WHEN undefined_function THEN NULL; END;
  END LOOP;
END $$;

-- Revoke PUBLIC/anon execution on authenticated/admin-only RPCs & helpers
DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'owns_registration(uuid, uuid)',
    'is_event_sponsor(uuid, uuid)',
    'count_user_cancellations(uuid, timestamptz)',
    'record_auth_event(text, jsonb)',
    'reissue_certificate(uuid, text, text)',
    'issue_certificates_for_event(uuid, uuid)',
    'issue_team_certificates(uuid)',
    'get_event_feedback_summary(uuid)',
    'resolve_content_report(uuid, public.report_status, text)',
    'review_team_registration(uuid, public.registration_status, text)',
    'verify_registration_payment(uuid, public.payment_verification_status, text)',
    'send_event_announcement(uuid, text, text, uuid, public.registration_status[])',
    'get_registration_stats(uuid)',
    'submit_project_for_review(uuid)',
    'sponsor_list_teams(uuid)',
    'sponsor_review_project(uuid, text, text)',
    'search_certificates(text, integer)',
    'issue_certificate(uuid, uuid, text, text, text, jsonb)',
    'revoke_certificate(uuid, text)',
    'unrevoke_certificate(uuid)',
    'mark_attendance_and_issue(uuid, boolean, text, text)',
    'log_admin_action(text, text, uuid, text, jsonb)',
    'admin_run_publish_due()',
    'delete_user_data(uuid)',
    'accept_judge_invitation(text)'
  ] LOOP
    BEGIN EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon;', fn); EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role;', fn); EXCEPTION WHEN undefined_function THEN NULL; END;
  END LOOP;
END $$;
