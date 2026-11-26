DROP POLICY IF EXISTS "Admins view subscribers" ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "Admins update subscribers" ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "Admins delete subscribers" ON public.newsletter_subscribers;

CREATE POLICY "Admins view subscribers"
  ON public.newsletter_subscribers FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update subscribers"
  ON public.newsletter_subscribers FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete subscribers"
  ON public.newsletter_subscribers FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));