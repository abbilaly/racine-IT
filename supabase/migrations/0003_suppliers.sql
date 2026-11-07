-- Racine IT Admin ERP — suppliers foundation
-- Additive only: creates the supplier profile and synchronization log tables
-- used by the admin supplier management module. Nothing existing is modified.

/* ================================================================ */
/* suppliers                                                        */
/* ================================================================ */

create table if not exists public.suppliers (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(name) between 1 and 160),
  slug         text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  contact_name text,
  email        text,
  phone        text,
  website      text,
  notes        text,
  enabled      boolean not null default true,
  last_sync_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists suppliers_slug_idx on public.suppliers (slug);
create index if not exists suppliers_name_idx on public.suppliers (lower(name));

drop trigger if exists suppliers_set_updated_at on public.suppliers;
create trigger suppliers_set_updated_at
  before update on public.suppliers
  for each row execute function public.set_updated_at();

alter table public.suppliers enable row level security;

drop policy if exists "public read suppliers" on public.suppliers;
create policy "public read suppliers" on public.suppliers
  for select to anon, authenticated using (true);

drop policy if exists "admins write suppliers" on public.suppliers;
create policy "admins write suppliers" on public.suppliers
  to authenticated with check (public.is_admin());
drop policy if exists "admins update suppliers" on public.suppliers;
create policy "admins update suppliers" on public.suppliers
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins delete suppliers" on public.suppliers;
create policy "admins delete suppliers" on public.suppliers
  for delete to authenticated using (public.is_admin());

/* ================================================================ */
/* supplier synchronization logs                                    */
/* ================================================================ */

create table if not exists public.supplier_sync_logs (
  id            uuid primary key default gen_random_uuid(),
  supplier_id   uuid not null references public.suppliers (id) on delete cascade,
  status        text not null check (status in ('success', 'partial', 'failed')),
  message       text not null default '',
  rows_processed integer not null default 0 check (rows_processed >= 0),
  rows_failed    integer not null default 0 check (rows_failed >= 0),
  started_at    timestamptz not null default now(),
  ended_at      timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index if not exists supplier_sync_logs_supplier_idx
  on public.supplier_sync_logs (supplier_id, created_at desc);
create index if not exists supplier_sync_logs_created_idx
  on public.supplier_sync_logs (created_at desc);

alter table public.supplier_sync_logs enable row level security;

drop policy if exists "admins read sync logs" on public.supplier_sync_logs;
create policy "admins read sync logs" on public.supplier_sync_logs
  for select to authenticated using (public.is_admin());
drop policy if exists "admins write sync logs" on public.supplier_sync_logs;
create policy "admins write sync logs" on public.supplier_sync_logs
  to authenticated with check (public.is_admin());
drop policy if exists "admins delete sync logs" on public.supplier_sync_logs;
create policy "admins delete sync logs" on public.supplier_sync_logs
  for delete to authenticated using (public.is_admin());