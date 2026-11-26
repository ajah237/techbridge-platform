CREATE OR REPLACE FUNCTION public.get_public_event_results(_event_id uuid)
 RETURNS TABLE(project_id uuid, title text, description text, cover_image_url text, demo_url text, total_score numeric, judge_count integer, rank bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH ev AS (
    SELECT id FROM public.events
    WHERE id = _event_id
      AND (status = 'completed'::event_status OR (judging_starts_at IS NOT NULL AND now() >= judging_starts_at))
  ),
  judge_totals AS (
    SELECT psi.project_id, psi.judge_id,
           CASE WHEN SUM(jc.weight * jc.max_score) > 0
                THEN (SUM(psi.score * jc.weight) / SUM(jc.weight * jc.max_score)) * 100 ELSE 0 END AS pct
    FROM public.project_score_items psi
    JOIN public.judging_criteria jc ON jc.id = psi.criterion_id
    GROUP BY psi.project_id, psi.judge_id
  ),
  scored AS (
    SELECT p.id AS project_id, p.title, p.description, p.cover_image_url, p.demo_url,
           COALESCE(ROUND(AVG(jt.pct)::numeric, 2), 0) AS total_score,
           COUNT(DISTINCT jt.judge_id)::int AS judge_count
    FROM public.projects p
    LEFT JOIN judge_totals jt ON jt.project_id = p.id
    WHERE p.event_id = _event_id
      AND (p.status = 'approved'::project_status OR p.submitted_at IS NOT NULL)
      AND EXISTS (SELECT 1 FROM ev)
    GROUP BY p.id
  )
  SELECT *, RANK() OVER (ORDER BY total_score DESC, judge_count DESC) AS rank
  FROM scored ORDER BY rank ASC, total_score DESC;
$function$;