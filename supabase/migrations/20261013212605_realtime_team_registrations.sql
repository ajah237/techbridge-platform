DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='team_registrations') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.team_registrations;
  END IF;
END $$;