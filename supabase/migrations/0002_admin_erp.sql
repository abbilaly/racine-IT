-- Racine IT Admin ERP extension
-- Applies on top of 0001_racine_core.sql.
-- All tables use RLS. Admin reads/writes go through the existing admin policies
-- and the is_admin() helper already shipped in the core migration.

create extension if not exists pgcrypto;

/* ================================================================ */
/* brands                                                          */
/* ================================================================ */

create table if not exists public.brands (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(name) between 1 and 120),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  logo_path   text,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists brands_slug_idx on public.brands (slug);
create index if not exists brands_name_idx on public.brands (lower(name));

drop trigger if exists brands_set_updated_at on public.brands;
create trigger brands_set_updated_at
  before update on public.brands
  for each row execute function public.set_updated_at();

alter table public.brands enable row level security;

create policy "public read brands" on public.brands
  for select to anon, authenticated using (true);

create policy "admins write brands" on public.brands
  to authenticated with check (public.is_admin());
create policy "admins update brands" on public.brands
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete brands" on public.brands
  for delete to authenticated using (public.is_admin());

/* ================================================================ */
/* quotations                                                      */
/* ================================================================ */

create table if not exists public.quotations (
  id                  uuid primary key default gen_random_uuid(),
  ref                 text not null unique check (ref ~ '^[A-Z0-9]{6,32}$'),
  customer_name       text not null check (length(customer_name) between 1 and 120),
  customer_company    text,
  customer_email      text not null check (length(customer_email) <= 254),
  customer_phone      text,
  status              text not null default 'draft'
                       check (status in ('draft', 'sent', 'accepted', 'rejected', 'expired')),
  valid_from          timestamptz not null default now(),
  valid_until         timestamptz not null,
  notes               text,
  terms               text,
  subtotal_cents      integer not null default 0 check (subtotal_cents >= 0),
  tax_cents           integer not null default 0 check (tax_cents >= 0),
  total_cents         integer not null default 0 check (total_cents >= 0),
  currency            text not null default 'USD',
  converted_order_id  uuid references public.orders (id) on delete set null,
  created_by          uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists quotations_ref_idx on public.quotations (ref);
create index if not exists quotations_status_idx on public.quotations (status);
create index if not exists quotations_created_idx on public.quotations (created_at desc);
create index if not exists quotations_customer_idx on public.quotations (lower(customer_email));
create index if not exists quotations_converted_idx on public.quotations (converted_order_id);

drop trigger if exists quotations_set_updated_at on public.quotations;
create trigger quotations_set_updated_at
  before update on public.quotations
  for each row execute function public.set_updated_at();

alter table public.quotations enable row level security;

create policy "public read quotations" on public.quotations
  for select to anon, authenticated using (true);
create policy "admins write quotations" on public.quotations
  to authenticated with check (public.is_admin());
create policy "admins update quotations" on public.quotations
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete quotations" on public.quotations
  for delete to authenticated using (public.is_admin());

/* ================================================================ */
/* quotation lines                                                 */
/* ================================================================ */

create table if not exists public.quotation_lines (
  id                 uuid primary key default gen_random_uuid(),
  quotation_id       uuid not null references public.quotations (id) on delete cascade,
  product_id         uuid references public.products (id) on delete set null,
  slug               text not null,
  title              text not null,
  qty                integer not null check (qty > 0),
  unit_price_cents   integer not null check (unit_price_cents >= 0),
  line_total_cents   integer not null check (line_total_cents >= 0),
  discount_percent   numeric(5,2) not null default 0 check (discount_percent >= 0 and discount_percent <= 100),
  description        text,
  created_at         timestamptz not null default now()
);

create index if not exists quotation_lines_quotation_idx on public.quotation_lines (quotation_id);
create index if not exists quotation_lines_product_idx on public.quotation_lines (product_id);

alter table public.quotation_lines enable row level security;

create policy "public read quotation lines" on public.quotation_lines
  for select to anon, authenticated using (true);
create policy "admins write quotation lines" on public.quotation_lines
  to authenticated with check (public.is_admin());
create policy "admins update quotation lines" on public.quotation_lines
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete quotation lines" on public.quotation_lines
  for delete to authenticated using (public.is_admin());

/* ================================================================ */
/* stock adjustments + inventory history                           */
/* ================================================================ */

create table if not exists public.stock_adjustments (
  id           uuid primary key default gen_random_uuid(),
  inventory_id uuid references public.inventory (id) on delete set null,
  product_id   uuid not null references public.products (id) on delete cascade,
  variant_id   uuid references public.product_variants (id) on delete set null,
  change       integer not null,
  reason       text not null check (length(reason) between 1 and 120),
  note         text,
  adjusted_by  uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists stock_adjustments_product_idx on public.stock_adjustments (product_id);
create index if not exists stock_adjustments_inventory_idx on public.stock_adjustments (inventory_id);
create index if not exists stock_adjustments_created_idx on public.stock_adjustments (created_at desc);

alter table public.stock_adjustments enable row level security;

create policy "admins read stock adjustments" on public.stock_adjustments
  for select to authenticated using (public.is_admin());
create policy "admins write stock adjustments" on public.stock_adjustments
  to authenticated with check (public.is_admin());

/* ================================================================ */
/* admin notes                                                     */
/* ================================================================ */

create table if not exists public.admin_notes (
  id           uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('orders', 'quotations', 'customers', 'products', 'stock_adjustments')),
  subject_id   text not null,
  author_id    uuid references auth.users (id) on delete set null,
  note         text not null check (length(note) between 1 and 4000),
  created_at   timestamptz not null default now()
);

create index if not exists admin_notes_subject_idx
  on public.admin_notes (subject_type, subject_id);
create index if not exists admin_notes_created_idx on public.admin_notes (created_at desc);

alter table public.admin_notes enable row level security;

create policy "admins read admin notes" on public.admin_notes
  for select to authenticated using (public.is_admin());
create policy "admins write admin notes" on public.admin_notes
  to authenticated with check (public.is_admin());
create policy "admins delete admin notes" on public.admin_notes
  for delete to authenticated using (public.is_admin());

/* ================================================================ */
/* email log                                                       */
/* ================================================================ */

create table if not exists public.email_log (
  id                  uuid primary key default gen_random_uuid(),
  kind                text not null check (kind in ('order_confirmation', 'order_status', 'quotation', 'admin_notification')),
  to_email            text not null,
  subject             text not null,
  body_preview        text,
  provider            text not null default 'resend',
  provider_message_id text,
  status              text not null default 'pending'
                       check (status in ('pending', 'queued', 'sent', 'delivered', 'failed')),
  error               text,
  payload             jsonb,
  created_at          timestamptz not null default now(),
  sent_at             timestamptz
);

create index if not exists email_log_to_idx on public.email_log (to_email);
create index if not exists email_log_kind_created_idx on public.email_log (kind, created_at desc);
create index if not exists email_log_status_idx on public.email_log (status);

alter table public.email_log enable row level security;

create policy "admins read email log" on public.email_log
  for select to authenticated using (public.is_admin());
create policy "admins write email log" on public.email_log
  to authenticated with check (public.is_admin());

/* ================================================================ */
/* helper: mark expired quotations                                 */
/* ================================================================ */

create or replace function public.mark_expired_quotations()
returns setof public.quotations
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.quotations
  set status = 'expired'
  where status = 'sent'
    and valid_until < now()
  returning *;
$$;

revoke all on function public.mark_expired_quotations() from public;
grant execute on function public.mark_expired_quotations() to service_role, authenticated;
