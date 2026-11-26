
DROP VIEW IF EXISTS public.blog_comments_public;
CREATE VIEW public.blog_comments_public
WITH (security_invoker = true) AS
SELECT id, post_id, parent_id, author_name, content, created_at, status
FROM public.blog_comments
WHERE status = 'approved'::comment_status;

GRANT SELECT ON public.blog_comments_public TO anon, authenticated;

REVOKE SELECT (admin_notes) ON public.projects FROM anon, authenticated;

DROP POLICY IF EXISTS "Users create conv with relationship" ON public.conversations;
CREATE POLICY "Users create conv with relationship"
ON public.conversations
FOR INSERT
TO authenticated
WITH CHECK (
  ((auth.uid() = user_a) OR (auth.uid() = user_b))
  AND (
    EXISTS (
      SELECT 1 FROM public.mentorship_requests mr
      WHERE mr.status = 'accepted'
        AND (
          (mr.mentor_id = conversations.user_a AND mr.mentee_id = conversations.user_b)
          OR
          (mr.mentor_id = conversations.user_b AND mr.mentee_id = conversations.user_a)
        )
    )
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);
