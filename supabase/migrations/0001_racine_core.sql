-- Racine IT — core schema
-- Target: a Supabase project (Postgres 15+). Apply with the Supabase CLI
-- (`supabase db push`) or paste into the SQL editor, then run supabase/seed.sql.
--
-- Conventions:
--   * money is stored as integer cents
--   * product slugs are the public identity used by the storefront
--   * order rows snapshot the product so history survives catalogue edits
--   * create_order() raises SQLSTATE RC001 for expected, user-facing failures

create extension if not exists pgcrypto;

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

/* ------------------------------------------------------------------ */
/* categories                                                          */
/* ------------------------------------------------------------------ */

create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  label       text not null check (length(label) between 1 and 60),
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

/* ------------------------------------------------------------------ */
/* products                                                            */
/* ------------------------------------------------------------------ */

create table if not exists public.products (
  id                     uuid primary key default gen_random_uuid(),
  slug                   text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title                  text not null check (length(title) between 1 and 180),
  category_id            uuid not null references public.categories (id),
  short_description      text not null default '',
  description            text[] not null default '{}',
  specs                  jsonb not null default '[]'::jsonb,
  price_cents            integer not null check (price_cents >= 0),
  compare_at_price_cents integer check (compare_at_price_cents is null or compare_at_price_cents >= price_cents),
  badge                  text,
  rating                 numeric(2,1) not null default 0 check (rating >= 0 and rating <= 5),
  reviews                integer not null default 0 check (reviews >= 0),
  is_active              boolean not null default true,
  is_featured            boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists products_category_idx on public.products (category_id);
create index if not exists products_active_idx on public.products (is_active);
create index if not exists products_title_idx on public.products (lower(title));

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

/* ------------------------------------------------------------------ */
/* product images (Supabase Storage object paths or local asset paths) */
/* ------------------------------------------------------------------ */

create table if not exists public.product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  kind       text not null default 'primary' check (kind in ('primary', 'hover')),
  path       text not null check (length(path) between 1 and 400),
  alt        text not null default '',
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists product_images_product_kind_uq
  on public.product_images (product_id, kind);
create index if not exists product_images_product_idx
  on public.product_images (product_id, position);

/* ------------------------------------------------------------------ */
/* product variants                                                    */
/* ------------------------------------------------------------------ */

create table if not exists public.product_variants (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products (id) on delete cascade,
  sku         text not null unique,
  name        text not null check (length(name) between 1 and 80),
  options     jsonb not null default '{}'::jsonb,
  price_cents integer check (price_cents is null or price_cents >= 0),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists product_variants_product_idx on public.product_variants (product_id);

drop trigger if exists product_variants_set_updated_at on public.product_variants;
create trigger product_variants_set_updated_at
  before update on public.product_variants
  for each row execute function public.set_updated_at();

/* ------------------------------------------------------------------ */
/* inventory                                                           */
/* ------------------------------------------------------------------ */

create table if not exists public.inventory (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  variant_id uuid references public.product_variants (id) on delete cascade,
  on_hand    integer not null default 0 check (on_hand >= 0),
  updated_at timestamptz not null default now()
);

-- exactly one stock row per product level, or per variant
create unique index if not exists inventory_product_level_uq
  on public.inventory (product_id) where variant_id is null;
create unique index if not exists inventory_variant_level_uq
  on public.inventory (variant_id) where variant_id is not null;
create index if not exists inventory_product_idx on public.inventory (product_id);

drop trigger if exists inventory_set_updated_at on public.inventory;
create trigger inventory_set_updated_at
  before update on public.inventory
  for each row execute function public.set_updated_at();

/* ------------------------------------------------------------------ */
/* store settings                                                      */
/* ------------------------------------------------------------------ */

create table if not exists public.store_settings (
  id                      boolean primary key default true check (id),
  store_name              text not null default 'Racine IT',
  currency                text not null default 'USD',
  standard_shipping_cents integer not null default 0 check (standard_shipping_cents >= 0),
  express_shipping_cents  integer not null default 1500 check (express_shipping_cents >= 0),
  checkout_enabled        boolean not null default true,
  order_email             text,
  updated_at              timestamptz not null default now()
);

insert into public.store_settings (id) values (true)
on conflict (id) do nothing;

drop trigger if exists store_settings_set_updated_at on public.store_settings;
create trigger store_settings_set_updated_at
  before update on public.store_settings
  for each row execute function public.set_updated_at();

/* ------------------------------------------------------------------ */
/* orders                                                              */
/* ------------------------------------------------------------------ */

create table if not exists public.orders (
  id         uuid primary key default gen_random_uuid(),
  ref        text not null unique check (ref ~ '^RIT-[A-Z0-9]{8}$'),
  status     text not null default 'received'
             check (status in ('received', 'processing', 'shipped', 'delivered', 'cancelled')),
  user_id    uuid references auth.users (id) on delete set null,
  first_name text not null,
  last_name  text not null,
  email      text not null,
  phone      text not null,
  address    text not null,
  city       text not null,
  postal     text not null,
  country    text not null,
  delivery   text not null check (delivery in ('standard', 'express')),
  payment    text not null check (payment in ('card', 'paypal', 'cod')),
  note       text,
  item_count integer not null check (item_count > 0),
  subtotal   integer not null check (subtotal >= 0),
  shipping   integer not null check (shipping >= 0),
  total      integer not null check (total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_created_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_email_idx on public.orders (lower(email));
create index if not exists orders_user_idx on public.orders (user_id);

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

/* ------------------------------------------------------------------ */
/* order items — historical snapshot of what was sold                 */
/* ------------------------------------------------------------------ */

create table if not exists public.order_items (
  id           bigint generated always as identity primary key,
  order_id     uuid not null references public.orders (id) on delete cascade,
  product_id   uuid references public.products (id) on delete set null,
  variant_id   uuid references public.product_variants (id) on delete set null,
  slug         text not null,
  title        text not null,
  variant_name text,
  unit_price   integer not null check (unit_price >= 0),
  qty          integer not null check (qty > 0),
  line_total   integer not null check (line_total >= 0),
  snapshot     jsonb not null default '{}'::jsonb
);

create index if not exists order_items_order_idx on public.order_items (order_id);
create index if not exists order_items_product_idx on public.order_items (product_id);

/* ------------------------------------------------------------------ */
/* administrator access                                                */
/* ------------------------------------------------------------------ */

create table if not exists public.admin_roles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  role       text not null default 'admin' check (role in ('admin', 'manager')),
  granted_by text,
  created_at timestamptz not null default now()
);

-- SECURITY DEFINER so policies can read admin_roles without recursing into its own RLS.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.admin_roles where user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

/* ------------------------------------------------------------------ */
/* atomic order creation                                               */
/* ------------------------------------------------------------------ */

-- create_order() is the only supported way to place an order.
-- It validates every line against the catalogue, locks the inventory rows it
-- touches (FOR UPDATE), re-prices everything from the database and writes the
-- order + items + stock decrement in one transaction. Any failure raises
-- SQLSTATE RC001, which rolls the whole transaction back — partial orders and
-- partially decremented stock are impossible.
create or replace function public.create_order(
  p_items    jsonb,
  p_customer jsonb,
  p_delivery text,
  p_payment  text,
  p_note     text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_settings     record;
  v_item         jsonb;
  v_slug         text;
  v_qty          numeric;
  v_qty_int      integer;
  v_variant_id   uuid;
  v_variant_text text;
  v_is_variant_active boolean;
  v_product      record;
  v_variant_name text;
  v_variant_price integer;
  v_inventory_id uuid;
  v_on_hand      integer;
  v_unit_price   integer;
  v_line_total   integer;
  v_subtotal     integer := 0;
  v_item_count   integer := 0;
  v_seen         jsonb := '{}'::jsonb;
  v_key          text;
  v_lines        jsonb := '[]'::jsonb;
  v_shipping     integer;
  v_total        integer;
  v_ref          text;
  v_order_id     uuid;
  v_created_at   timestamptz;
  v_line         jsonb;
  v_first        text;
  v_last         text;
  v_email        text;
  v_phone        text;
  v_address      text;
  v_city         text;
  v_postal       text;
  v_country      text;
  v_image        text;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your cart is empty.' using errcode = 'RC001';
  end if;
  if jsonb_array_length(p_items) > 40 then
    raise exception 'Too many lines in the cart.' using errcode = 'RC001';
  end if;
  if p_delivery is null or p_delivery not in ('standard', 'express') then
    raise exception 'Delivery method is invalid.' using errcode = 'RC001';
  end if;
  if p_payment is null or p_payment not in ('card', 'paypal', 'cod') then
    raise exception 'Payment method is invalid.' using errcode = 'RC001';
  end if;
  if p_customer is null or jsonb_typeof(p_customer) <> 'object' then
    raise exception 'Delivery details are required.' using errcode = 'RC001';
  end if;

  /* ---- customer validation (the API checks too; this is the backstop) ---- */
  v_first   := trim(both from coalesce(p_customer ->> 'firstName', ''));
  v_last    := trim(both from coalesce(p_customer ->> 'lastName', ''));
  v_email   := trim(both from coalesce(p_customer ->> 'email', ''));
  v_phone   := trim(both from coalesce(p_customer ->> 'phone', ''));
  v_address := trim(both from coalesce(p_customer ->> 'address', ''));
  v_city    := trim(both from coalesce(p_customer ->> 'city', ''));
  v_postal  := trim(both from coalesce(p_customer ->> 'postal', ''));
  v_country := trim(both from coalesce(p_customer ->> 'country', ''));

  if length(v_first) < 1 or length(v_first) > 60 then
    raise exception 'First name is required.' using errcode = 'RC001';
  end if;
  if length(v_last) < 1 or length(v_last) > 60 then
    raise exception 'Last name is required.' using errcode = 'RC001';
  end if;
  if length(v_email) > 120 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Enter a valid email address.' using errcode = 'RC001';
  end if;
  if length(v_phone) < 5 or length(v_phone) > 40 then
    raise exception 'Phone number is required.' using errcode = 'RC001';
  end if;
  if length(v_address) < 3 or length(v_address) > 160 then
    raise exception 'Address is required.' using errcode = 'RC001';
  end if;
  if length(v_city) < 1 or length(v_city) > 80 then
    raise exception 'City is required.' using errcode = 'RC001';
  end if;
  if v_postal !~ '^[A-Za-z0-9 -]{3,10}$' then
    raise exception 'Postal code is invalid.' using errcode = 'RC001';
  end if;
  if length(v_country) < 2 or length(v_country) > 56 then
    raise exception 'Country is required.' using errcode = 'RC001';
  end if;
  if p_note is not null and length(p_note) > 500 then
    raise exception 'The note is too long.' using errcode = 'RC001';
  end if;

  select * into v_settings from public.store_settings where id = true for share;
  if not found then
    raise exception 'Checkout is temporarily unavailable. Please try again later.'
      using errcode = 'RC001';
  end if;
  if v_settings.checkout_enabled = false then
    raise exception 'Checkout is temporarily unavailable. Please try again later.'
      using errcode = 'RC001';
  end if;

  /* ---- lines: locked in a stable order so concurrent checkouts cannot deadlock ---- */
  for v_item in
    select elem from jsonb_array_elements(p_items) as elem
    order by coalesce(elem ->> 'slug', '')
  loop
    v_slug := trim(both from coalesce(v_item ->> 'slug', ''));
    if v_slug = '' then
      raise exception 'A cart line is missing its product.' using errcode = 'RC001';
    end if;

    if jsonb_typeof(v_item -> 'qty') is distinct from 'number' then
      raise exception 'Quantity must be a whole number between 1 and 20.' using errcode = 'RC001';
    end if;
    v_qty := (v_item ->> 'qty')::numeric;
    if v_qty is null or v_qty <> floor(v_qty) or v_qty < 1 or v_qty > 20 then
      raise exception 'Quantity must be a whole number between 1 and 20.' using errcode = 'RC001';
    end if;
    v_qty_int := v_qty::integer;

    v_variant_text := v_item ->> 'variant_id';
    if v_variant_text is null or v_variant_text = '' then
      v_variant_id := null;
    elsif v_variant_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      v_variant_id := v_variant_text::uuid;
    else
      raise exception 'One of the product variants in your cart is invalid.' using errcode = 'RC001';
    end if;

    v_key := v_slug || '|' || coalesce(v_variant_id::text, '');
    if coalesce(v_seen ->> v_key, '') <> '' then
      raise exception 'The same product appears more than once in your cart.' using errcode = 'RC001';
    end if;
    v_seen := jsonb_set(v_seen, array[v_key], to_jsonb(true), true);

    select p.id, p.slug, p.title, p.short_description, p.specs,
           p.price_cents, p.is_active, p.compare_at_price_cents,
           c.slug as category_slug, c.label as category_label
      into v_product
      from public.products p
      join public.categories c on c.id = p.category_id
     where p.slug = v_slug;

    if not found or v_product.is_active = false then
      raise exception 'One of the products in your cart is no longer available.' using errcode = 'RC001';
    end if;

    v_variant_name := null;
    v_variant_price := null;
    if v_variant_id is not null then
      select name, price_cents, is_active
        into v_variant_name, v_variant_price, v_is_variant_active
        from public.product_variants
       where id = v_variant_id and product_id = v_product.id;
      if not found or v_is_variant_active = false then
        raise exception 'One of the product variants in your cart is no longer available.'
          using errcode = 'RC001';
      end if;
    end if;

    -- lock this stock row for the rest of the transaction
    select id, on_hand into v_inventory_id, v_on_hand
      from public.inventory
     where product_id = v_product.id
       and variant_id is not distinct from v_variant_id
       for update;

    if not found then
      raise exception '“%” is currently unavailable.', v_product.title using errcode = 'RC001';
    end if;
    if v_qty_int > v_on_hand then
      raise exception 'Only % left of “%”. Adjust the quantity and try again.',
        v_on_hand, v_product.title using errcode = 'RC001';
    end if;

    v_unit_price := case
      when v_variant_id is not null and v_variant_price is not null
        then v_variant_price
      else v_product.price_cents
    end;
    v_line_total := v_unit_price * v_qty_int;

    select path into v_image
      from public.product_images
     where product_id = v_product.id and kind = 'primary';

    v_line := jsonb_build_object(
      'product_id', v_product.id,
      'variant_id', v_variant_id,
      'slug', v_product.slug,
      'title', v_product.title,
      'variant_name', v_variant_name,
      'unit_price', v_unit_price,
      'qty', v_qty_int,
      'line_total', v_line_total,
      'snapshot', jsonb_build_object(
        'slug', v_product.slug,
        'title', v_product.title,
        'image', coalesce(v_image, ''),
        'category', v_product.category_slug,
        'category_label', v_product.category_label,
        'short', v_product.short_description,
        'specs', v_product.specs,
        'price_cents', v_unit_price,
        'compare_at_price_cents',
          case when v_variant_price is not null then null else v_product.compare_at_price_cents end,
        'variant', v_variant_name
      )
    );
    v_lines := v_lines || jsonb_build_array(v_line);

    v_subtotal   := v_subtotal + v_line_total;
    v_item_count := v_item_count + v_qty_int;

    -- decrement stock now, while the row lock is held
    update public.inventory set on_hand = on_hand - v_qty_int where id = v_inventory_id;
  end loop;

  v_shipping := case when p_delivery = 'express'
                     then v_settings.express_shipping_cents
                     else v_settings.standard_shipping_cents end;
  v_total := v_subtotal + v_shipping;
  v_created_at := now();

  /* ---- order reference: RIT-XXXXXXXX, retrying on the (rare) collision ---- */
  loop
    v_ref := 'RIT-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    exit when not exists (select 1 from public.orders o where o.ref = v_ref);
  end loop;

  insert into public.orders (
    ref, status, user_id, first_name, last_name, email, phone, address, city,
    postal, country, delivery, payment, note, item_count, subtotal, shipping, total, created_at
  ) values (
    v_ref, 'received', auth.uid(), v_first, v_last, v_email, v_phone, v_address, v_city,
    v_postal, v_country, p_delivery, p_payment, p_note, v_item_count,
    v_subtotal, v_shipping, v_total, v_created_at
  )
  returning id into v_order_id;

  insert into public.order_items (
    order_id, product_id, variant_id, slug, title, variant_name,
    unit_price, qty, line_total, snapshot
  )
  select
    v_order_id,
    (line ->> 'product_id')::uuid,
    (line ->> 'variant_id')::uuid,
    line ->> 'slug',
    line ->> 'title',
    line ->> 'variant_name',
    (line ->> 'unit_price')::integer,
    (line ->> 'qty')::integer,
    (line ->> 'line_total')::integer,
    line -> 'snapshot'
  from jsonb_array_elements(v_lines) as line;

  return jsonb_build_object(
    'ok', true,
    'id', v_order_id,
    'ref', v_ref,
    'status', 'received',
    'item_count', v_item_count,
    'subtotal', v_subtotal,
    'shipping', v_shipping,
    'total', v_total,
    'created_at', v_created_at
  );
end;
$$;

-- Only the server (service role) may place orders; the storefront never calls
-- this through the public PostgREST role, so orders cannot be created directly
-- by anonymous clients.
revoke all on function public.create_order(jsonb, jsonb, text, text, text) from public;
revoke all on function public.create_order(jsonb, jsonb, text, text, text) from anon;
revoke all on function public.create_order(jsonb, jsonb, text, text, text) from authenticated;
grant execute on function public.create_order(jsonb, jsonb, text, text, text) to service_role;

/* ------------------------------------------------------------------ */
/* row level security                                                   */
/* ------------------------------------------------------------------ */

alter table public.categories      enable row level security;
alter table public.products        enable row level security;
alter table public.product_images  enable row level security;
alter table public.product_variants enable row level security;
alter table public.inventory       enable row level security;
alter table public.store_settings  enable row level security;
alter table public.orders          enable row level security;
alter table public.order_items     enable row level security;
alter table public.admin_roles     enable row level security;

-- public catalogue: everyone may browse, only admins may write
drop policy if exists "public read categories" on public.categories;
create policy "public read categories" on public.categories
  for select to anon, authenticated using (true);

drop policy if exists "admins write categories" on public.categories;
create policy "admins write categories" on public.categories
  to authenticated with check (public.is_admin());
drop policy if exists "admins update categories" on public.categories;
create policy "admins update categories" on public.categories
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins delete categories" on public.categories;
create policy "admins delete categories" on public.categories
  for delete to authenticated using (public.is_admin());

drop policy if exists "public read products" on public.products;
create policy "public read products" on public.products
  for select to anon, authenticated using (is_active = true or public.is_admin());

drop policy if exists "admins insert products" on public.products;
create policy "admins insert products" on public.products
  for insert to authenticated with check (public.is_admin());
drop policy if exists "admins update products" on public.products;
create policy "admins update products" on public.products
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins delete products" on public.products;
create policy "admins delete products" on public.products
  for delete to authenticated using (public.is_admin());

drop policy if exists "public read product images" on public.product_images;
create policy "public read product images" on public.product_images
  for select to anon, authenticated using (true);
drop policy if exists "admins write product images" on public.product_images;
create policy "admins write product images" on public.product_images
  to authenticated with check (public.is_admin());
drop policy if exists "admins delete product images" on public.product_images;
create policy "admins delete product images" on public.product_images
  for delete to authenticated using (public.is_admin());

drop policy if exists "public read variants" on public.product_variants;
create policy "public read variants" on public.product_variants
  for select to anon, authenticated using (is_active = true or public.is_admin());
drop policy if exists "admins write variants" on public.product_variants;
create policy "admins write variants" on public.product_variants
  to authenticated with check (public.is_admin());
drop policy if exists "admins update variants" on public.product_variants;
create policy "admins update variants" on public.product_variants
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins delete variants" on public.product_variants;
create policy "admins delete variants" on public.product_variants
  for delete to authenticated using (public.is_admin());

-- stock counts are public (the storefront shows "only N left") but stock is
-- only ever changed by create_order() (service role) or by an admin
drop policy if exists "public read inventory" on public.inventory;
create policy "public read inventory" on public.inventory
  for select to anon, authenticated using (true);
drop policy if exists "admins write inventory" on public.inventory;
create policy "admins write inventory" on public.inventory
  to authenticated with check (public.is_admin());
drop policy if exists "admins update inventory" on public.inventory;
create policy "admins update inventory" on public.inventory
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read store settings" on public.store_settings;
create policy "public read store settings" on public.store_settings
  for select to anon, authenticated using (true);
drop policy if exists "admins update store settings" on public.store_settings;
create policy "admins update store settings" on public.store_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- orders: no policy for anon/authenticated shoppers at all → denied by default.
-- The storefront reads and writes them only through the service role; the
-- policies below give administrators read access under RLS.
drop policy if exists "admins read orders" on public.orders;
create policy "admins read orders" on public.orders
  for select to authenticated using (public.is_admin());
drop policy if exists "admins update orders" on public.orders;
create policy "admins update orders" on public.orders
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins read order items" on public.order_items;
create policy "admins read order items" on public.order_items
  for select to authenticated using (public.is_admin());

-- a signed-in customer may see their own role row and nothing else
drop policy if exists "read own admin role" on public.admin_roles;
create policy "read own admin role" on public.admin_roles
  for select to authenticated using (user_id = auth.uid());

/* ------------------------------------------------------------------ */
/* product image storage                                               */
/* ------------------------------------------------------------------ */

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "public read product image objects" on storage.objects;
create policy "public read product image objects" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'product-images');

drop policy if exists "admins upload product images" on storage.objects;
create policy "admins upload product images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "admins replace product images" on storage.objects;
create policy "admins replace product images" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "admins remove product images" on storage.objects;
create policy "admins remove product images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin());
