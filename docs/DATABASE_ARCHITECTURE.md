# TechBridge Database Architecture & Security Reference

## 1. Migration Unification & Canonical History

Previously, database DDL was split across two directories:
- `supabase/migrations/` (70 migrations from `20260303063356` through `20260420031521`)
- `drizzle/migrations/` (6 custom-SQL migrations `0000`–`0005` authored between Oct 3, 2026 and Nov 15, 2026)

All 6 Drizzle migrations have been unified into `supabase/migrations/` with their exact chronological timestamps from `drizzle/migrations/meta/_journal.json`, followed by the comprehensive reorganization and security hardening migration:

| Order | Supabase Migration File | Drizzle Mirror | Summary |
| :--- | :--- | :--- | :--- |
| 71 | `20261003035213_submissions_sponsors_event_mode.sql` | `0000_submissions_sponsors_event_mode.sql` | Adds `event_submissions`, `event_people`, `sponsorships`, `event_announcements`, and `events.participation_mode` |
| 72 | `20261003042825_sponsor_portal_and_team_certificates.sql` | `0001_sponsor_portal_and_team_certificates.sql` | Adds `sponsorships.sponsor_user_id`, `event_submissions` sponsor approval columns, `issue_team_certificates()` |
| 73 | `20261003045354_submission_doc_uploads.sql` | `0002_submission_doc_uploads.sql` | Adds `event_submissions.doc_files` JSONB and `submission-docs` storage bucket |
| 74 | `20261113191746_realtime_team_registrations.sql` | `0003_realtime_team_registrations.sql` | Adds `team_registrations` to `supabase_realtime` publication |
| 75 | `20261115111011_realtime_event_results.sql` | `0004_realtime_event_results.sql` | Adds `projects`, `judging_criteria`, `project_score_items` to `supabase_realtime` |
| 76 | `20261115113517_live_results_during_judging.sql` | `0005_live_results_during_judging.sql` | Updates `get_event_results()` to expose live standings for `ongoing` and `completed` events |
| 77 | `20261120000000_database_reorganization_and_security_hardening.sql` | `0006_database_reorganization_and_security_hardening.sql` | Full security hardening, dead object removal, FK/CHECK/Index reorganization, and RPC consolidation |

## 2. Canonical Drizzle ORM Schema (`drizzle/schema.ts`)

`drizzle/schema.ts` now defines the entire PostgreSQL schema organized into 8 domain sections:
1. **Enums:** `app_role`, `event_type`, `event_status`, `post_status`
2. **Domain 1 — Identity, Profiles & RBAC:** `profiles`, `user_roles`, `auth_audit_log`
3. **Domain 2 — Events, Categories, Registrations & Team Portal:** `events`, `event_registrations`, `event_feedback`, `event_waitlist`, `event_categories`, `team_registrations`, `registration_participants`, `registration_payments`, `registration_events`, `event_submissions`, `event_people`, `event_announcements`
4. **Domain 3 — Hackathon Teams, Projects, Judging & Sponsorships:** `event_teams`, `event_team_members`, `projects`, `project_votes`, `project_comments`, `judging_criteria`, `project_score_items`, `judge_invitations`, `sponsorships`
5. **Domain 4 — Certificates, Templates, Share Tokens & Reissues:** `certificates`, `certificate_templates`, `certificate_share_tokens`, `certificate_reissues`
6. **Domain 5 — Blog, Comments, Likes & Newsletter:** `blog_posts`, `blog_comments`, `blog_likes`, `newsletter_subscribers`, `newsletter_audit_log`
7. **Domain 6 — Community Forum & Content Moderation:** `forum_categories`, `forum_threads`, `forum_replies`, `forum_upvotes`, `content_reports`
8. **Domain 7 — Mentorship, Direct Messaging, Notifications & Gamification:** `mentor_availability`, `mentorship_requests`, `mentor_bookings`, `mentor_reviews`, `conversations`, `direct_messages`, `notifications`, `badges`, `user_badges`, `points_log`
9. **Domain 8 — Site Settings, Contact Submissions, Analytics & Admin Audit Logs:** `site_settings`, `contact_submissions`, `analytics_events`, `admin_audit_log`

## 3. Security Hardening Summary (`20261120000000`)

- **PII Protection on `profiles`:** Dropped the public `USING (true)` SELECT policy on `public.profiles` that exposed user email addresses, phone numbers, and notification preferences to unauthenticated callers. Users can query their own profile row (`auth.uid() = user_id`), admins can query all rows, and public pages resolve non-sensitive profile cards via the `SECURITY DEFINER` RPC `public.get_public_profiles(_user_ids uuid[])`.
- **Feedback Anonymity:** Replaced the `USING (true)` policy on `public.event_feedback` with owner/admin SELECT and a trigger `trg_enforce_event_feedback_attendance` requiring confirmed event registration before submitting feedback. Public rating breakdowns are served via `get_event_feedback_summary(_event_id)`.
- **Certificate Share Token Hardening:** Removed the `USING (expires_at > now())` table-scan SELECT policy on `public.certificate_share_tokens`. Token redemption goes exclusively through `public.get_certificate_by_share_token(_token)`.
- **Blog Likes & Analytics Tightening:** Restricted `blog_likes` DELETE to owner/admin (`session_id` must match `auth.uid()::text` for authenticated users), added input length constraints on `analytics_events`, and fixed `increment_blog_view` to filter `status = 'published'`.
- **Sponsor & Team Portal Integrity:** Restricted sponsor review updates on `event_submissions` via `trg_restrict_submission_update` so sponsors can only modify `sponsor_approved`, `sponsor_notes`, `sponsor_reviewed_by`, and `sponsor_reviewed_at`, while team leaders cannot self-approve their own submissions.
- **Storage Bucket Hardening:** Enforced `file_size_limit = 5242880` (5 MB) and strict MIME allowlists (`image/png`, `image/jpeg`, `image/webp`, `image/gif` — excluding `image/svg+xml`) on all public image buckets (`blog-images`, `event-images`, `avatars`, `project-images`, `certificate-assets`).
- **Dead Object Cleanup & Function Unification:** Dropped unused legacy table `public.project_scores` and dead view `public.leaderboard` (superseded by `project_score_items` and `get_leaderboard()`), dropped the 1-arg `issue_certificates_for_event(uuid)` overload in favor of `issue_certificates_for_event(_event_id uuid, _program_id uuid DEFAULT NULL)`, and expanded `delete_user_data()` to clean up all user-linked records before account deletion.
