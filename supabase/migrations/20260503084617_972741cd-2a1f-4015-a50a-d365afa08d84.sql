
-- Recreate leaderboard view with security_invoker
DROP VIEW IF EXISTS public.leaderboard;
CREATE VIEW public.leaderboard
WITH (security_invoker = true) AS
SELECT 
  p.user_id,
  p.full_name,
  p.avatar_url,
  COALESCE(SUM(pl.points), 0)::int AS total_points,
  COUNT(DISTINCT ub.badge_id)::int AS badge_count
FROM public.profiles p
LEFT JOIN public.points_log pl ON pl.user_id = p.user_id
LEFT JOIN public.user_badges ub ON ub.user_id = p.user_id
GROUP BY p.user_id, p.full_name, p.avatar_url;

-- The view is filtered by profiles RLS (own row only). Allow public read of leaderboard via grants on a SECURITY DEFINER RPC instead.
-- Simpler: grant select on view to anon, but it returns nothing due to underlying RLS. Use an RPC for the leaderboard.
CREATE OR REPLACE FUNCTION public.get_leaderboard(limit_n int DEFAULT 50)
RETURNS TABLE(user_id uuid, full_name text, avatar_url text, total_points int, badge_count int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.user_id, p.full_name, p.avatar_url,
    COALESCE(SUM(pl.points),0)::int AS total_points,
    COUNT(DISTINCT ub.badge_id)::int AS badge_count
  FROM public.profiles p
  LEFT JOIN public.points_log pl ON pl.user_id = p.user_id
  LEFT JOIN public.user_badges ub ON ub.user_id = p.user_id
  GROUP BY p.user_id, p.full_name, p.avatar_url
  ORDER BY total_points DESC
  LIMIT limit_n;
$$;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(int) TO anon, authenticated;

-- Revoke execute on trigger functions
REVOKE EXECUTE ON FUNCTION public.award_points_event_reg() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.award_points_project() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.award_points_certificate() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.check_badge_awards() FROM anon, authenticated, public;
