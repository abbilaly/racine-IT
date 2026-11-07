-- 0005_email_center.sql
-- Email Center: provider events, follow-up jobs and suppression list.
-- Additive only: no existing table, column or row is dropped or rewritten.

-- ---------------------------------------------------------------------------
-- 1. email_log: allow provider lifecycle statuses + related records
-- ---------------------------------------------------------------------------

alter table public.email_log
  drop constraint if exists email_log_status_check;

alter table public.email_log
  add constraint email_log_status_check
  check (status in (
    'pending', 'queued', 'sent', 'delivered',
    'opened', 'clicked', 'bounced', 'complained', 'failed'
  ));

alter table public.email_log
  add column if not exists related_type text,
  add column if not exists related_id   uuid,
  add column if not exists last_event_at timestamptz;

create index if not exists email_log_provider_message_idx
  on public.email_log (provider_message_id);
create index if not exists email_log_related_idx
  on public.email_log (related_type, related_id);

-- ---------------------------------------------------------------------------
-- 2. email_events: one row per verified provider event (idempotency guard)
-- ---------------------------------------------------------------------------

create table if not exists public.email_events (
  id                uuid primary key default gen_random_uuid(),
  provider          text not null default 'resend',
  provider_event_id text not null,
  email_log_id      uuid references public.email_log (id) on delete cascade,
  event_type        text not null,
  payload           jsonb,
  received_at       timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create index if not exists email_events_log_idx
  on public.email_events (email_log_id, received_at desc);

-- ---------------------------------------------------------------------------
-- 3. Follow-up rules and scheduled jobs
-- ---------------------------------------------------------------------------

create table if not exists public.followup_rules (
  id                 uuid primary key default gen_random_uuid(),
  name               text,
  target_type        text not null check (target_type in ('quotation', 'order')),
  target_id          uuid,
  initial_delay_days integer not null default 3 check (initial_delay_days between 1 and 90),
  template_kind      text not null default 'quotation',
  subject            text not null,
  html               text not null,
  status             text not null default 'draft'
                     check (status in ('draft', 'active', 'paused', 'cancelled')),
  created_by         uuid,
  processed_count    integer not null default 0,
  error              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists followup_rules_status_idx
  on public.followup_rules (status, created_at desc);

create table if not exists public.followup_jobs (
  id           uuid primary key default gen_random_uuid(),
  rule_id      uuid not null references public.followup_rules (id) on delete cascade,
  target_type  text not null check (target_type in ('quotation', 'order')),
  target_id    uuid not null,
  target_ref   text,
  subject      text not null,
  html         text not null,
  scheduled_at timestamptz not null,
  sent_at      timestamptz,
  status       text not null default 'scheduled'
               check (status in ('scheduled', 'sent', 'cancelled', 'failed')),
  error        text,
  created_at   timestamptz not null default now(),
  unique (rule_id, target_type, target_id, scheduled_at)
);

create index if not exists followup_jobs_due_idx
  on public.followup_jobs (status, scheduled_at);

-- ---------------------------------------------------------------------------
-- 4. Suppression list (opt-out, bounce, complaint)
-- ---------------------------------------------------------------------------

create table if not exists public.email_suppressions (
  email      text primary key,
  reason     text not null check (reason in ('opt_out', 'bounce', 'complaint', 'manual')),
  note       text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 5. Row level security: administrators only
-- ---------------------------------------------------------------------------

create or replace function public.email_center_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_roles r where r.user_id = auth.uid()
  );
$$;

alter table public.email_events       enable row level security;
alter table public.followup_rules     enable row level security;
alter table public.followup_jobs      enable row level security;
alter table public.email_suppressions enable row level security;

drop policy if exists "admins read email events" on public.email_events;
create policy "admins read email events" on public.email_events
  for select using (public.email_center_is_admin());

drop policy if exists "admins read followup rules" on public.followup_rules;
create policy "admins read followup rules" on public.followup_rules
  for select using (public.email_center_is_admin());

drop policy if exists "admins write followup rules" on public.followup_rules;
create policy "admins write followup rules" on public.followup_rules
  for all using (public.email_center_is_admin())
  with check (public.email_center_is_admin());

drop policy if exists "admins read followup jobs" on public.followup_jobs;
create policy "admins read followup jobs" on public.followup_jobs
  for select using (public.email_center_is_admin());

drop policy if exists "admins write followup jobs" on public.followup_jobs;
create policy "admins write followup jobs" on public.followup_jobs
  for all using (public.email_center_is_admin())
  with check (public.email_center_is_admin());

drop policy if exists "admins read email suppressions" on public.email_suppressions;
create policy "admins read email suppressions" on public.email_suppressions
  for select using (public.email_center_is_admin());

-- ---------------------------------------------------------------------------
-- 6. Keep updated_at fresh on rules
-- ---------------------------------------------------------------------------

create or replace function public.email_center_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists followup_rules_touch on public.followup_rules;
create trigger followup_rules_touch
  before update on public.followup_rules
  for each row execute function public.email_center_touch_updated_at();
