
create table if not exists public.auth_audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_type text not null,
  affected_user_id uuid,
  actor_id uuid,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists auth_audit_log_created_at_idx on public.auth_audit_log (created_at desc);
create index if not exists auth_audit_log_affected_user_idx on public.auth_audit_log (affected_user_id);
create index if not exists auth_audit_log_event_type_idx on public.auth_audit_log (event_type);

grant select on public.auth_audit_log to authenticated;
grant all on public.auth_audit_log to service_role;

alter table public.auth_audit_log enable row level security;

create policy "Admins can read auth audit"
on public.auth_audit_log for select to authenticated
using (public.has_role(auth.uid(), 'admin'::app_role));

-- No insert/update/delete policies — only SECURITY DEFINER triggers/service_role write here.

create or replace function public.log_user_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.auth_audit_log(event_type, affected_user_id, actor_id, metadata)
    values ('role.granted', new.user_id, auth.uid(),
            jsonb_build_object('role', new.role));
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.auth_audit_log(event_type, affected_user_id, actor_id, metadata)
    values ('role.revoked', old.user_id, auth.uid(),
            jsonb_build_object('role', old.role));
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_log_user_role_change_ins on public.user_roles;
drop trigger if exists trg_log_user_role_change_del on public.user_roles;

create trigger trg_log_user_role_change_ins
after insert on public.user_roles
for each row execute function public.log_user_role_change();

create trigger trg_log_user_role_change_del
after delete on public.user_roles
for each row execute function public.log_user_role_change();

-- Helper for edge functions / client to record auth events (sign-in, sign-out, password reset, etc.)
create or replace function public.record_auth_event(_event_type text, _metadata jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into public.auth_audit_log(event_type, affected_user_id, actor_id, metadata)
  values (_event_type, auth.uid(), auth.uid(), coalesce(_metadata, '{}'::jsonb))
  returning id into new_id;
  return new_id;
end;
$$;
