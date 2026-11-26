DROP POLICY "Events are viewable by everyone" ON public.events;

CREATE POLICY "Published events are viewable by everyone"
ON public.events FOR SELECT
USING (status <> 'draft' OR public.has_role(auth.uid(), 'admin'));