
-- Tighten profiles SELECT: own profile + admin
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
CREATE POLICY "Users can view own profile or admins view all"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- Tighten certificates SELECT: own certs + admin
DROP POLICY IF EXISTS "Authenticated users can view certificates" ON public.certificates;
CREATE POLICY "Users can view own certs or admins view all"
  ON public.certificates FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));
