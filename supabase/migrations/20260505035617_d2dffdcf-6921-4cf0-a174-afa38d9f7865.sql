
-- Site settings (single row keyed by id='global')
CREATE TABLE IF NOT EXISTS public.site_settings (
  id text PRIMARY KEY DEFAULT 'global',
  contact_email text,
  contact_phone text,
  office_address text,
  twitter_url text,
  linkedin_url text,
  github_url text,
  youtube_url text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Site settings public read" ON public.site_settings
  FOR SELECT USING (true);

CREATE POLICY "Admins update site settings" ON public.site_settings
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert site settings" ON public.site_settings
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.site_settings (id, contact_email, contact_phone, office_address, twitter_url, linkedin_url, github_url, youtube_url)
VALUES ('global', 'hello@techbridge.org', '+1 (555) 123-4567', E'TechBridge HQ\nYour City, Your Country',
  'https://twitter.com/techbridge', 'https://www.linkedin.com/company/techbridge',
  'https://github.com/techbridge', 'https://www.youtube.com/@techbridge')
ON CONFLICT (id) DO NOTHING;

CREATE TRIGGER trg_site_settings_updated
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Newsletter unsubscribe support
ALTER TABLE public.newsletter_subscribers
  ADD COLUMN IF NOT EXISTS unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS newsletter_subscribers_token_idx
  ON public.newsletter_subscribers(unsubscribe_token);

-- Allow admins to update subscribers (confirm/resend status)
DROP POLICY IF EXISTS "Admins update subscribers" ON public.newsletter_subscribers;
CREATE POLICY "Admins update subscribers" ON public.newsletter_subscribers
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Public unsubscribe RPC (token-based, no auth required)
CREATE OR REPLACE FUNCTION public.unsubscribe_newsletter(_token uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_affected int;
BEGIN
  UPDATE public.newsletter_subscribers
  SET unsubscribed_at = now()
  WHERE unsubscribe_token = _token AND unsubscribed_at IS NULL;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.unsubscribe_newsletter(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unsubscribe_newsletter(uuid) TO anon, authenticated;
