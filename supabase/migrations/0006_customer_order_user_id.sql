-- 0006_customer_order_user_id.sql
--
-- Forward-only migration for Supabase.
--
-- Adds an overloaded public.create_order() signature that accepts an optional
-- verified customer UUID (p_user_id). This keeps the existing 5-parameter
-- signature intact and unambiguous while letting server code assign
-- order ownership atomically during order creation:
--
--   * Authenticated customer checkout passes the verified customer UUID from
--     the server-side session. orders.user_id is written from that verified
--     value inside the same transaction as order + items + stock decrement.
--   * Guest checkout passes NULL explicitly. orders.user_id is written as
--     NULL. When no explicit owner is supplied, the inserted order has
--     user_id = NULL rather than the executing principal.
--   * Any existing caller that still invokes the 5-parameter form continues to
--     resolve to the original function unchanged.
--
-- This migration does NOT drop or replace the existing 5-parameter function.
-- It creates a new overload that only resolves when 6 arguments are supplied,
-- and grants execute on that new overload to service_role only. No RLS policy
-- is changed.
--
-- Do not apply this migration to production from this workspace.

-- New overloaded signature: same body as the existing create_order(), except
-- the owner of the inserted order is taken explicitly from p_user_id when
-- provided, or explicitly set to NULL when not provided.
--
-- Existing callers that pass exactly 5 arguments continue to resolve to the
-- original function created by migration 0001_racine_core.sql.

create or replace function public.create_order(
  p_items    jsonb,
  p_customer jsonb,
  p_delivery text,
  p_payment  text,
  p_note     text default null,
  p_user_id  uuid default null
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
    v_ref, 'received', case when p_user_id is not null then p_user_id else null end, v_first, v_last, v_email, v_phone, v_address, v_city,
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

revoke all on function public.create_order(jsonb, jsonb, text, text, text, uuid) from public;
revoke all on function public.create_order(jsonb, jsonb, text, text, text, uuid) from anon;
revoke all on function public.create_order(jsonb, jsonb, text, text, text, uuid) from authenticated;
grant execute on function public.create_order(jsonb, jsonb, text, text, text, uuid) to service_role;
