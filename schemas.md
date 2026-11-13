# Racine IT Admin — current schema understanding

Used as the single source of truth while building the ERP upgrade so I do
not invent tables or columns.

## Supabase (Postgres) — real, deployed

`supabase/migrations/0001_racine_core.sql` has been applied.

### categories
- id uuid pk
- slug text unique
- label text
- position int
- created_at
- RLS: public read, admin write

### products
- id uuid pk
- slug text unique
- title text
- category_id uuid -> categories
- short_description text
- description text[]
- specs jsonb
- price_cents int
- compare_at_price_cents int nullable
- badge text
- rating numeric(2,1)
- reviews int
- is_active bool
- is_featured bool
- created_at, updated_at
- RLS: public read active, admin write

### product_images
- id uuid pk
- product_id -> products
- kind primary|hover
- path text
- alt text
- position int
- RLS: public read, admin write
- unique(product_id, kind)

### product_variants
- id uuid pk
- product_id -> products
- sku text unique
- name text
- options jsonb
- price_cents int nullable
- is_active bool
- created_at, updated_at

### inventory
- id uuid pk
- product_id -> products
- variant_id -> product_variants nullable
- on_hand int
- updated_at
- exactly one product-level row where variant_id is null
- exactly one variant-level row per variant_id
- RLS: public read, admin write

### store_settings
- id boolean pk true
- store_name, currency
- standard_shipping_cents, express_shipping_cents
- checkout_enabled bool
- order_email text nullable
- updated_at

### orders
- id uuid pk
- ref RIT-XXXXXXXX unique
- status received|processing|shipped|delivered|cancelled
- user_id -> auth.users nullable
- first_name, last_name, email, phone, address, city, postal, country
- delivery standard|express
- payment card|paypal|cod
- note text
- item_count, subtotal, shipping, total (cents)
- created_at, updated_at
- RLS: admins read + update only; no anon/auth policy

### order_items
- id bigserial pk
- order_id -> orders
- product_id -> products nullable
- variant_id -> product_variants nullable
- slug, title, variant_name
- unit_price, qty, line_total (cents)
- snapshot jsonb
- RLS: admins read only

### admin_roles
- user_id uuid pk -> auth.users
- role admin|manager
- granted_by text
- created_at
- RLS: own row read, no write policies here (bootstrap uses service role)

### auth.users
- managed by Supabase Auth

### storage
- bucket product-images, public, admin upload policy

### functions
- create_order(p_items, p_customer, p_delivery, p_payment, p_note) returns jsonb
  - security definer, service_role only
  - locks inventory FOR UPDATE
  - re-prices from DB, decrements stock, writes order + items
  - raises RC001 on expected failures

## D1 fallback (original project)
- tables: orders, order_items
- used by lib/server/orders.ts only when Supabase is not configured
- Admin dashboard and order management use Supabase, not D1

## New tables I will add (Supabase)

### brands
- id uuid pk
- name text unique
- slug text unique
- description text
- logo_path text nullable
- position int
- created_at, updated_at

### quotations
- id uuid pk
- ref QTN-XXXXXXXX unique
- customer_name, customer_company, customer_email, customer_phone
- status draft|sent|accepted|rejected|expired
- valid_from, valid_until timestamptz
- notes text
- subtotal, tax_cents, total, total_cents (cents)
- currency text
- converted_order_id uuid nullable -> orders
- created_by admin user id
- created_at, updated_at

### quotation_lines
- id uuid pk
- quotation_id -> quotations
- product_id -> products nullable
- slug, title
- qty int
- unit_price_cents, line_total_cents (cents)
- discount_percent
- created_at

### stock_adjustments
- id uuid pk
- inventory_id uuid -> inventory (optional, product-level)
- product_id -> products
- variant_id nullable
- change int (signed)
- reason text
- adjusted_by admin user id
- note text
- created_at

### email_log
- id uuid pk
- kind order_confirmation|order_status|quotation|admin_notification
- to email
- subject text
- provider string
- provider_message_id text
- status sent|failed|pending
- error text nullable
- created_at

### admin_notes
- id uuid pk
- subject_type orders|quotations|customers|products|stock_adjustments
- subject_id text
- author_id admin user id
- note text
- created_at

## New admin APIs I will add

### Products
- POST/PATCH/DELETE /api/admin/products ✅ exists
- POST /api/admin/products/image ✅ exists
- new:
  - GET /api/admin/products (list, search, filters, pagination)
  - POST /api/admin/products/bulk (bulk edit safe fields)
  - POST /api/admin/products/import (CSV/XLSX, preview-first)
  - GET /api/admin/products/export (CSV/XLSX)
  - GET /api/admin/products/template (download import template)
  - GET /api/admin/categories (list)
  - POST/PATCH/DELETE /api/admin/categories
  - GET /api/admin/brands (list)
  - POST/PATCH/DELETE /api/admin/brands
  - GET /api/admin/inventory (product stock + history)
  - POST /api/admin/inventory/adjust (stock adjustment)

### Orders
- PATCH /api/admin/orders ✅ exists
- new:
  - GET /api/admin/orders (list, filters, pagination)
  - GET /api/admin/orders/:id (full detail + items + customer)
  - POST /api/admin/orders/:id/notes (internal note)
  - POST /api/admin/orders/:id/email (resend confirmation)

### Customers
- GET /api/admin/customers (list, search)
- GET /api/admin/customers/:id (profile + order history)

### Reports
- GET /api/admin/reports/sales (date range)
- GET /api/admin/reports/products (best sellers, low stock)
- GET /api/admin/reports/orders (by status)

### Quotations
- GET /api/admin/quotations
- POST /api/admin/quotations
- GET /api/admin/quotations/:id
- PATCH /api/admin/quotations/:id
- POST /api/admin/quotations/:id/lines
- DELETE /api/admin/quotations/:id/lines/:lineId
- POST /api/admin/quotations/:id/convert (to order)
- POST /api/admin/quotations/:id/send

### Email
- POST /api/admin/email/test (admin-only test send)

## New admin pages I will add

- /admin — dashboard (enhanced)
- /admin/products
- /admin/products/new
- /admin/products/[id]
- /admin/products/import
- /admin/products/export
- /admin/orders
- /admin/orders/[id]
- /admin/customers
- /admin/customers/[id]
- /admin/settings (exists)
- /admin/categories
- /admin/brands
- /admin/inventory
- /admin/reports
- /admin/quotations
- /admin/quotations/[id]
- /admin/email/test

## Not implementing in this project

- Supplier API integrations against real distributors (no credentials/documentation)
- Real payment provider integration (project is demo; no card collection today)
- Full B2B self-service portal unless explicitly requested later
