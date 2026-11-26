# Disaster Recovery Runbook

TechBridge runs on **Lovable Cloud** (managed Supabase). Backups, retention,
and restore are managed by the platform — this document covers how to
verify them and execute a recovery drill.

## Backup posture (managed)

| Item | Default |
|------|---------|
| Daily logical backups | 7-day retention (Free/Pro), longer on higher tiers |
| Point-in-time recovery (PITR) | Available on Pro+; granularity ≈ 2 minutes |
| Storage objects | Replicated by the underlying object store |
| Edge function source | Versioned in this Git repo |

## Quarterly DR drill (checklist)

1. **Pick a recovery target** — e.g. "state at yesterday 14:00 UTC".
2. **Snapshot expected counts** (run in production):
   ```sql
   select 'users' k, count(*) from auth.users
   union all select 'events',  count(*) from public.events
   union all select 'regs',    count(*) from public.event_registrations
   union all select 'certs',   count(*) from public.certificates;
   ```
3. **Create a staging project** in Lovable Cloud (new branch/preview env).
4. **Restore** the chosen point via Cloud → Database → Backups → *Restore*
   (PITR if enabled, otherwise newest daily snapshot).
5. **Verify** in staging:
   - Row counts within tolerance of step 2.
   - Sign in with a known test user.
   - Open `/dashboard` — registrations, certificates, notifications load.
   - Open a published event detail page.
   - Run `select * from public.verify_certificate('TB-XXXX-XXXX-XXXX');`
6. **Record** RPO/RTO observed (time-to-restore + data-loss window) in
   `docs/dr-log.md`.
7. **Tear down** the staging project to avoid cost.

## Recovery time objectives

| Scenario | RPO | RTO |
|----------|----:|----:|
| Accidental table truncation | ≤ 2 min (PITR) | < 30 min |
| Region outage | ≤ 24 h (daily backup) | < 2 h |
| Storage bucket corruption | n/a (object versioning) | < 1 h |

## Out-of-band exports (extra safety)

An additional weekly logical dump can be triggered locally:

```bash
supabase --project-ref <ref> db dump --data-only > backups/$(date +%F).sql
```

Store the file in an off-platform location (S3, GCS, or local).