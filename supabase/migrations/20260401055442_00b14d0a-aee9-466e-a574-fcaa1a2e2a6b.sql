
-- Allow users to cancel their own registrations
CREATE POLICY "Users can cancel own registration"
  ON public.event_registrations FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Remove the broad ALL policy on user_roles to avoid fragile OR stacking
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
