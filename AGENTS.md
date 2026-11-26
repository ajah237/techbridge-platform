# AGENTS
- Project review status and submitted_at change only via admin or security-definer RPCs (guard_project_status trigger) — prevents teams self-approving.
- Sponsor access is derived from sponsorships.sponsor_user_id via is_event_sponsor(); sponsors read teams through sponsor_list_teams RPC — keeps participant PII out of sponsor reach.
- Event key dates are built in src/lib/eventTimeline.ts from event + category columns — one source for event page and team portal.
- Team certificates are issued via issue_team_certificates RPC from approved team_registrations participants; wording derives from event_type/participant role inside issue_certificate — one source for certificate text.
