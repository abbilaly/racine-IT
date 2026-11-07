-- Racine IT Admin ERP — product brands + image gallery
-- Additive only. No rows are modified and no data is deleted.

/* ================================================================ */
/* link products to brands                                          */
/* ================================================================ */

alter table public.products
  add column if not exists brand_id uuid references public.brands (id) on delete set null;

create index if not exists products_brand_idx on public.products (brand_id);

/* ================================================================ */
/* allow more than two images per product                           */
/* the core migration limited each product to one 'primary' and     */
/* one 'hover' image; the admin gallery also writes 'gallery' rows  */
/* ================================================================ */

alter table public.product_images drop constraint if exists product_images_kind_check;
alter table public.product_images
  add constraint product_images_kind_check check (kind in ('primary', 'hover', 'gallery'));

drop index if exists public.product_images_product_kind_uq;
create unique index if not exists product_images_primary_uq
  on public.product_images (product_id) where kind = 'primary';
create unique index if not exists product_images_hover_uq
  on public.product_images (product_id) where kind = 'hover';
create index if not exists product_images_gallery_idx
  on public.product_images (product_id, position) where kind = 'gallery';