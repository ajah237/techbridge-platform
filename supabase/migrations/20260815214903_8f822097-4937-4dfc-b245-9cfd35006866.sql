-- Enums
CREATE TYPE public.registration_status AS ENUM ('draft','submitted','payment_pending','payment_verification','approved','rejected','withdrawn');
CREATE TYPE public.payment_verification_status AS ENUM ('unpaid','pending','verified','rejected');
CREATE TYPE public.participant_role AS ENUM ('leader','member','teacher_mentor','coach');

-- Reusable public event page content
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS theme text,
  ADD COLUMN IF NOT EXISTS venue text,
  ADD COLUMN IF NOT EXISTS overview text,
  ADD COLUMN IF NOT EXISTS rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS timeline jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS faqs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS registration_open boolean NOT NULL DEFAULT true;

-- Categories
CREATE TABLE public.event_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  eligibility text,
  competition_date timestamptz,
  challenge_release_at timestamptz,
  registration_deadline timestamptz,
  min_team_size integer NOT NULL DEFAULT 1,
  max_team_size integer NOT NULL DEFAULT 5,
  institution_label text NOT NULL DEFAULT 'Institution',
  requires_institution boolean NOT NULL DEFAULT true,
  requires_teacher_mentor boolean NOT NULL DEFAULT false,
  requires_class_level boolean NOT NULL DEFAULT false,
  currency text NOT NULL DEFAULT 'FCFA',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, slug)
);
GRANT SELECT ON public.event_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_categories TO authenticated;
GRANT ALL ON public.event_categories TO service_role;
ALTER TABLE public.event_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categories of visible events are public"
  ON public.event_categories FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.status <> 'draft'::event_status));
CREATE POLICY "Admins read all categories"
  ON public.event_categories FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage categories"
  ON public.event_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Fee tiers
CREATE TABLE public.category_fee_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.event_categories(id) ON DELETE CASCADE,
  label text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'FCFA',
  opens_at timestamptz,
  closes_at timestamptz,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.category_fee_tiers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.category_fee_tiers TO authenticated;
GRANT ALL ON public.category_fee_tiers TO service_role;
ALTER TABLE public.category_fee_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Fee tiers of visible events are public"
  ON public.category_fee_tiers FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.event_categories c
    JOIN public.events e ON e.id = c.event_id
    WHERE c.id = category_id AND e.status <> 'draft'::event_status));
CREATE POLICY "Admins read all fee tiers"
  ON public.category_fee_tiers FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage fee tiers"
  ON public.category_fee_tiers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Team registrations
CREATE TABLE public.team_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.event_categories(id) ON DELETE SET NULL,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  team_name text,
  team_code text,
  reference text,
  institution_name text,
  institution_type text,
  institution_town text,
  institution_region text,
  institution_address text,
  fee_tier_id uuid REFERENCES public.category_fee_tiers(id) ON DELETE SET NULL,
  fee_tier_label text,
  fee_amount numeric,
  currency text NOT NULL DEFAULT 'FCFA',
  status public.registration_status NOT NULL DEFAULT 'draft',
  declaration_accepted boolean NOT NULL DEFAULT false,
  notes text,
  review_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  submitted_at timestamptz,
  current_step integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_code),
  UNIQUE (reference)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_registrations TO authenticated;
GRANT ALL ON public.team_registrations TO service_role;
ALTER TABLE public.team_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read own registrations"
  ON public.team_registrations FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owners create registrations"
  ON public.team_registrations FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "Owners edit editable registrations"
  ON public.team_registrations FOR UPDATE TO authenticated
  USING (created_by = auth.uid() AND status IN ('draft','submitted','payment_pending'))
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "Owners delete drafts"
  ON public.team_registrations FOR DELETE TO authenticated
  USING (created_by = auth.uid() AND status = 'draft');
CREATE POLICY "Admins manage registrations"
  ON public.team_registrations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.owns_registration(_registration_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.team_registrations r WHERE r.id = _registration_id AND r.created_by = _user_id);
$$;

-- Participants
CREATE TABLE public.registration_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES public.team_registrations(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role public.participant_role NOT NULL DEFAULT 'member',
  email text,
  phone text,
  gender text,
  date_of_birth date,
  class_level text,
  department text,
  is_leader boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.registration_participants TO authenticated;
GRANT ALL ON public.registration_participants TO service_role;
ALTER TABLE public.registration_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read participants"
  ON public.registration_participants FOR SELECT TO authenticated
  USING (public.owns_registration(registration_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owners write participants"
  ON public.registration_participants FOR INSERT TO authenticated
  WITH CHECK (public.owns_registration(registration_id, auth.uid()));
CREATE POLICY "Owners update participants"
  ON public.registration_participants FOR UPDATE TO authenticated
  USING (public.owns_registration(registration_id, auth.uid()))
  WITH CHECK (public.owns_registration(registration_id, auth.uid()));
CREATE POLICY "Owners delete participants"
  ON public.registration_participants FOR DELETE TO authenticated
  USING (public.owns_registration(registration_id, auth.uid()));
CREATE POLICY "Admins manage participants"
  ON public.registration_participants FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Payments
CREATE TABLE public.registration_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES public.team_registrations(id) ON DELETE CASCADE,
  method text NOT NULL DEFAULT 'mobile_money',
  transaction_reference text,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'FCFA',
  payer_name text,
  payer_phone text,
  proof_url text,
  status public.payment_verification_status NOT NULL DEFAULT 'pending',
  verified_by uuid,
  verified_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.registration_payments TO authenticated;
GRANT ALL ON public.registration_payments TO service_role;
ALTER TABLE public.registration_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read payments"
  ON public.registration_payments FOR SELECT TO authenticated
  USING (public.owns_registration(registration_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owners create payments"
  ON public.registration_payments FOR INSERT TO authenticated
  WITH CHECK (public.owns_registration(registration_id, auth.uid()));
CREATE POLICY "Owners update own pending payments"
  ON public.registration_payments FOR UPDATE TO authenticated
  USING (public.owns_registration(registration_id, auth.uid()) AND status <> 'verified')
  WITH CHECK (public.owns_registration(registration_id, auth.uid()));
CREATE POLICY "Admins manage payments"
  ON public.registration_payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- History / audit trail
CREATE TABLE public.registration_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES public.team_registrations(id) ON DELETE CASCADE,
  actor_id uuid,
  actor_role text,
  event_type text NOT NULL,
  from_status public.registration_status,
  to_status public.registration_status,
  note text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.registration_events TO authenticated;
GRANT ALL ON public.registration_events TO service_role;
ALTER TABLE public.registration_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners and admins read registration history"
  ON public.registration_events FOR SELECT TO authenticated
  USING (public.owns_registration(registration_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

-- Announcements
CREATE TABLE public.event_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.event_categories(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text NOT NULL,
  sent_by uuid NOT NULL DEFAULT auth.uid(),
  recipient_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.event_announcements TO authenticated;
GRANT ALL ON public.event_announcements TO service_role;
ALTER TABLE public.event_announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read announcements"
  ON public.event_announcements FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Event people roster (judges, mentors, sponsors, volunteers)
CREATE TABLE public.event_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'judge',
  full_name text NOT NULL,
  organisation text,
  role_title text,
  email text,
  phone text,
  photo_url text,
  website_url text,
  notes text,
  is_public boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_people TO authenticated;
GRANT ALL ON public.event_people TO service_role;
ALTER TABLE public.event_people ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage event people"
  ON public.event_people FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- updated_at triggers
CREATE TRIGGER trg_event_categories_updated BEFORE UPDATE ON public.event_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_category_fee_tiers_updated BEFORE UPDATE ON public.category_fee_tiers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_team_registrations_updated BEFORE UPDATE ON public.team_registrations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_registration_participants_updated BEFORE UPDATE ON public.registration_participants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_registration_payments_updated BEFORE UPDATE ON public.registration_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_event_people_updated BEFORE UPDATE ON public.event_people FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Team code + reference generation on submit
CREATE OR REPLACE FUNCTION public.assign_registration_codes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  seg text;
  i int;
  yr text := to_char(now(), 'YYYY');
BEGIN
  IF NEW.status <> 'draft' AND NEW.team_code IS NULL THEN
    LOOP
      seg := '';
      FOR i IN 1..6 LOOP
        seg := seg || substr(chars, 1 + floor(random() * length(chars))::int, 1);
      END LOOP;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.team_registrations WHERE team_code = 'TM-' || yr || '-' || seg);
    END LOOP;
    NEW.team_code := 'TM-' || yr || '-' || seg;
  END IF;

  IF NEW.status <> 'draft' AND NEW.reference IS NULL THEN
    LOOP
      seg := '';
      FOR i IN 1..8 LOOP
        seg := seg || substr(chars, 1 + floor(random() * length(chars))::int, 1);
      END LOOP;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.team_registrations WHERE reference = 'REG-' || yr || '-' || seg);
    END LOOP;
    NEW.reference := 'REG-' || yr || '-' || seg;
  END IF;

  IF NEW.status <> 'draft' AND NEW.submitted_at IS NULL THEN
    NEW.submitted_at := now();
  END IF;

  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_assign_registration_codes BEFORE INSERT OR UPDATE ON public.team_registrations FOR EACH ROW EXECUTE FUNCTION public.assign_registration_codes();

-- Status history + notifications
CREATE OR REPLACE FUNCTION public.log_registration_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role text;
  ev_title text;
BEGIN
  IF v_actor IS NULL THEN v_role := 'system';
  ELSIF v_actor = NEW.created_by THEN v_role := 'team';
  ELSIF has_role(v_actor, 'admin'::app_role) THEN v_role := 'admin';
  ELSE v_role := 'other';
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.registration_events(registration_id, actor_id, actor_role, event_type, to_status)
    VALUES (NEW.id, v_actor, v_role, 'created', NEW.status);
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.registration_events(registration_id, actor_id, actor_role, event_type, from_status, to_status, note)
    VALUES (NEW.id, v_actor, v_role, 'status_changed', OLD.status, NEW.status, NEW.review_notes);

    SELECT title INTO ev_title FROM public.events WHERE id = NEW.event_id;
    INSERT INTO public.notifications(user_id, title, message, type, link)
    VALUES (
      NEW.created_by,
      'Registration ' || replace(NEW.status::text, '_', ' '),
      'Your team registration' || COALESCE(' ' || NEW.reference, '') || ' for "' || COALESCE(ev_title, 'an event') || '" is now ' || replace(NEW.status::text, '_', ' ') || '.',
      CASE WHEN NEW.status = 'approved' THEN 'success' WHEN NEW.status IN ('rejected','withdrawn') THEN 'warning' ELSE 'info' END,
      '/dashboard'
    );
  END IF;

  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_log_registration_event AFTER INSERT OR UPDATE ON public.team_registrations FOR EACH ROW EXECUTE FUNCTION public.log_registration_event();

-- Admin review helper
CREATE OR REPLACE FUNCTION public.review_team_registration(_id uuid, _status public.registration_status, _notes text DEFAULT NULL)
RETURNS public.team_registrations LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE row public.team_registrations;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.team_registrations
     SET status = _status,
         review_notes = NULLIF(btrim(COALESCE(_notes,'')), ''),
         reviewed_by = auth.uid(),
         reviewed_at = now()
   WHERE id = _id
   RETURNING * INTO row;
  IF row.id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;

  INSERT INTO public.admin_audit_log(performed_by, action, resource_type, resource_id, resource_label, metadata)
  VALUES (auth.uid(), 'registration.' || _status::text, 'event', row.id, row.reference,
          jsonb_build_object('team', row.team_name, 'notes', _notes));
  RETURN row;
END;
$$;

-- Admin payment verification
CREATE OR REPLACE FUNCTION public.verify_registration_payment(_payment_id uuid, _status public.payment_verification_status, _notes text DEFAULT NULL)
RETURNS public.registration_payments LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE row public.registration_payments;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.registration_payments
     SET status = _status, notes = COALESCE(NULLIF(btrim(COALESCE(_notes,'')), ''), notes),
         verified_by = auth.uid(), verified_at = now()
   WHERE id = _payment_id
   RETURNING * INTO row;
  IF row.id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;

  IF _status = 'verified' THEN
    UPDATE public.team_registrations SET status = 'approved' WHERE id = row.registration_id AND status IN ('payment_pending','payment_verification','submitted');
  END IF;

  INSERT INTO public.admin_audit_log(performed_by, action, resource_type, resource_id, resource_label, metadata)
  VALUES (auth.uid(), 'registration.payment_' || _status::text, 'event', row.registration_id, row.transaction_reference, jsonb_build_object('amount', row.amount));
  RETURN row;
END;
$$;

-- Announcement fan-out
CREATE OR REPLACE FUNCTION public.send_event_announcement(_event_id uuid, _title text, _body text, _category_id uuid DEFAULT NULL, _statuses public.registration_status[] DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sent int := 0;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH targets AS (
    SELECT DISTINCT created_by FROM public.team_registrations
     WHERE event_id = _event_id
       AND (_category_id IS NULL OR category_id = _category_id)
       AND (_statuses IS NULL OR status = ANY(_statuses))
       AND status <> 'draft'
  ), ins AS (
    INSERT INTO public.notifications(user_id, title, message, type, link)
    SELECT created_by, _title, _body, 'info', '/dashboard' FROM targets
    RETURNING 1
  )
  SELECT count(*) INTO sent FROM ins;

  INSERT INTO public.event_announcements(event_id, category_id, title, body, sent_by, recipient_count)
  VALUES (_event_id, _category_id, _title, _body, auth.uid(), sent);

  INSERT INTO public.admin_audit_log(performed_by, action, resource_type, resource_id, resource_label, metadata)
  VALUES (auth.uid(), 'event.announcement', 'event', _event_id, _title, jsonb_build_object('recipients', sent));

  RETURN sent;
END;
$$;

-- Registration statistics for admin dashboards
CREATE OR REPLACE FUNCTION public.get_registration_stats(_event_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN has_role(auth.uid(), 'admin'::app_role) THEN jsonb_build_object(
    'teams', (SELECT count(*) FROM public.team_registrations r WHERE (_event_id IS NULL OR r.event_id = _event_id) AND r.status <> 'draft'),
    'drafts', (SELECT count(*) FROM public.team_registrations r WHERE (_event_id IS NULL OR r.event_id = _event_id) AND r.status = 'draft'),
    'approved', (SELECT count(*) FROM public.team_registrations r WHERE (_event_id IS NULL OR r.event_id = _event_id) AND r.status = 'approved'),
    'participants', (SELECT count(*) FROM public.registration_participants p JOIN public.team_registrations r ON r.id = p.registration_id WHERE (_event_id IS NULL OR r.event_id = _event_id) AND r.status <> 'draft'),
    'revenue_verified', (SELECT COALESCE(SUM(pm.amount),0) FROM public.registration_payments pm JOIN public.team_registrations r ON r.id = pm.registration_id WHERE (_event_id IS NULL OR r.event_id = _event_id) AND pm.status = 'verified'),
    'by_status', (SELECT COALESCE(jsonb_object_agg(s, c), '{}'::jsonb) FROM (SELECT status::text AS s, count(*) AS c FROM public.team_registrations r WHERE (_event_id IS NULL OR r.event_id = _event_id) GROUP BY status) t)
  ) ELSE '{}'::jsonb END;
$$;