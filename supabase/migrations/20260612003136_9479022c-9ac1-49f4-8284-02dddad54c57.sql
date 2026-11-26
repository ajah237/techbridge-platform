
CREATE OR REPLACE FUNCTION public.get_weekly_leaderboard(limit_n integer DEFAULT 50)
RETURNS TABLE(user_id uuid, full_name text, avatar_url text, total_points integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.full_name, p.avatar_url,
         COALESCE(SUM(pl.points), 0)::int AS total_points
  FROM public.profiles p
  JOIN public.points_log pl ON pl.user_id = p.user_id
  WHERE pl.created_at >= now() - interval '7 days'
  GROUP BY p.user_id, p.full_name, p.avatar_url
  HAVING COALESCE(SUM(pl.points), 0) > 0
  ORDER BY total_points DESC
  LIMIT limit_n;
$$;

REVOKE EXECUTE ON FUNCTION public.get_weekly_leaderboard(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_weekly_leaderboard(integer) TO anon, authenticated, service_role;
