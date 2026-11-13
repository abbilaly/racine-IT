-- Synthetic data for the local restore rehearsal only. No production values.
-- Loaded after supabase/migrations so the dump/restore cycle exercises every
-- table the integrity checks care about. Guest checkout means orders.user_id
-- stays null, exactly like the MVP.

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'drill-admin@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'drill-customer@example.test')
on conflict (id) do nothing;

insert into public.admin_roles (user_id, role) values
  ('11111111-1111-4111-8111-111111111111', 'admin')
on conflict (user_id) do nothing;

insert into public.categories (id, slug, label, position) values
  ('c0000000-0000-4000-8000-000000000001', 'drill-computing', 'Drill Computing', 1),
  ('c0000000-0000-4000-8000-000000000002', 'drill-audio', 'Drill Audio', 2),
  ('c0000000-0000-4000-8000-000000000003', 'drill-accessories', 'Drill Accessories', 3)
on conflict (id) do nothing;

insert into public.brands (id, name, slug) values
  ('b0000000-0000-4000-8000-000000000001', 'Drill Brand', 'drill-brand')
on conflict (id) do nothing;

insert into public.products
  (id, slug, title, category_id, short_description, price_cents, is_active, is_featured, brand_id)
values
  ('a0000000-0000-4000-8000-000000000001', 'drill-laptop-14', 'Drill Laptop 14', 'c0000000-0000-4000-8000-000000000001', 'Synthetic laptop', 129900, true, true,  'b0000000-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-000000000002', 'drill-laptop-16', 'Drill Laptop 16', 'c0000000-0000-4000-8000-000000000001', 'Synthetic laptop', 189900, true, false, null),
  ('a0000000-0000-4000-8000-000000000003', 'drill-headphones', 'Drill Headphones', 'c0000000-0000-4000-8000-000000000002', 'Synthetic audio', 24900, true, false, null),
  ('a0000000-0000-4000-8000-000000000004', 'drill-speaker', 'Drill Speaker', 'c0000000-0000-4000-8000-000000000002', 'Synthetic audio', 8900, true, false, null),
  ('a0000000-0000-4000-8000-000000000005', 'drill-retired-cable', 'Drill Retired Cable', 'c0000000-0000-4000-8000-000000000003', 'Inactive fixture row', 900, false, false, null)
on conflict (id) do nothing;

insert into public.product_images (product_id, kind, path, alt, position) values
  ('a0000000-0000-4000-8000-000000000001', 'primary', '/images/drill-laptop-14.webp', 'Drill Laptop 14', 0),
  ('a0000000-0000-4000-8000-000000000001', 'hover',   '/images/drill-laptop-14-alt.webp', 'Drill Laptop 14 alt', 1),
  ('a0000000-0000-4000-8000-000000000002', 'primary', '/images/drill-laptop-16.webp', 'Drill Laptop 16', 0),
  ('a0000000-0000-4000-8000-000000000003', 'primary', '/images/drill-headphones.webp', 'Drill Headphones', 0),
  ('a0000000-0000-4000-8000-000000000004', 'primary', '/images/drill-speaker.webp', 'Drill Speaker', 0),
  ('a0000000-0000-4000-8000-000000000005', 'primary', '/images/drill-cable.webp', 'Drill Retired Cable', 0)
on conflict do nothing;

insert into public.inventory (product_id, on_hand) values
  ('a0000000-0000-4000-8000-000000000001', 4),
  ('a0000000-0000-4000-8000-000000000002', 2),
  ('a0000000-0000-4000-8000-000000000003', 12),
  ('a0000000-0000-4000-8000-000000000004', 7),
  ('a0000000-0000-4000-8000-000000000005', 0)
on conflict do nothing;

insert into public.store_settings (id, store_name, currency, standard_shipping_cents, express_shipping_cents)
values (true, 'Drill Store', 'USD', 500, 1500)
on conflict (id) do nothing;

insert into public.orders
  (id, ref, status, user_id, first_name, last_name, email, phone, address, city, postal, country,
   delivery, payment, note, item_count, subtotal, shipping, total, created_at)
values
  ('d0000000-0000-4000-8000-000000000001', 'RIT-DRILL001', 'received', null,
   'Ada', 'Drill', 'ada@example.test', '+10000000001', '1 Synthetic Way', 'Testville', '00001', 'US',
   'standard', 'cod', null, 2, 154800, 500, 155300, now() - interval '2 days'),
  ('d0000000-0000-4000-8000-000000000002', 'RIT-DRILL002', 'shipped', null,
   'Grace', 'Drill', 'grace@example.test', '+10000000002', '2 Synthetic Way', 'Testville', '00002', 'US',
   'express', 'card', 'Leave at door', 1, 129900, 1500, 131400, now() - interval '1 day'),
  ('d0000000-0000-4000-8000-000000000003', 'RIT-DRILL003', 'cancelled', null,
   'Alan', 'Drill', 'alan@example.test', '+10000000003', '3 Synthetic Way', 'Testville', '00003', 'US',
   'standard', 'paypal', null, 1, 8900, 500, 9400, now() - interval '6 hours')
on conflict (id) do nothing;

insert into public.order_items
  (order_id, product_id, slug, title, unit_price, qty, line_total)
values
  ('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'drill-laptop-14', 'Drill Laptop 14', 129900, 1, 129900),
  ('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'drill-headphones', 'Drill Headphones', 24900, 1, 24900),
  ('d0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'drill-laptop-14', 'Drill Laptop 14', 129900, 1, 129900),
  ('d0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000004', 'drill-speaker', 'Drill Speaker', 8900, 1, 8900);
