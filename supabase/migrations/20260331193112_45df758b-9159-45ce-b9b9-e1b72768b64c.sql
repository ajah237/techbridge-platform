
CREATE TABLE public.certificates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  certificate_number TEXT NOT NULL UNIQUE,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  recipient_name TEXT NOT NULL,
  issued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

-- Anyone can view certificates (public verification)
CREATE POLICY "Certificates are viewable by everyone"
  ON public.certificates FOR SELECT TO public
  USING (true);

-- Admins can manage certificates
CREATE POLICY "Admins can insert certificates"
  ON public.certificates FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update certificates"
  ON public.certificates FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete certificates"
  ON public.certificates FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
