# AB Tech catalogue — supplier data request

Updated: 15 November 2026

## Why this exists

The category structure and category pages can be built from the existing
database. Brands, products, prices, stock and country of origin cannot be
filled in without a verified source. This note records what was checked, what
is still missing, and the rules used for importing it.

No brand, product, price, stock figure or country of origin has been invented
or copied from a competitor's shop.

## Sources checked

| Source | Role | Evidence |
| --- | --- | --- |
| Disway — https://www.disway.com/qui-sommes-nous | **Wholesale distributor (supplier candidate)** | Describes itself as Morocco's leading wholesale distributor of IT and telecom equipment, ~6,000 references and ~50 international brands, serving resellers. |
| JouTech — https://joutech.ma/qui-sommes-nous | **Wholesaler (supplier candidate)** | Describes itself as one of the major IT wholesalers, 2,000+ products, official wholesaler for several manufacturers. |
| NT Revolution — https://nt-revolution.ma/ | **Small IT distributor (supplier candidate)** | Lists itself as a distributor/wholesale computer equipment seller; public products are priced "on request". |
| TechPro — https://www.techpro.ma/ | **Reseller / market reference (competitor)** | Sells to professionals and individuals with public retail prices; not a confirmed supplier. |

Listing a brand on a competitor's site is **not** evidence that AB Tech stocks
it, so competitor catalogues are used only to understand the market — never as
the source of our prices, stock or brand relationships.

## Still needed before products can be imported

1. **Supplier access**
   - Disway reseller account (or a price/stock export from the account manager).
   - JouTech reseller account or current wholesale price list.
   - Confirmation of whether NT Revolution is an approved supplier.
2. **Product data, per SKU**
   - Manufacturer part number / SKU and exact product name.
   - Category and subcategory.
   - Supplier cost and recommended retail price (in MAD, tax treatment stated).
   - Verified stock quantity and warehouse.
   - Warranty terms as documented by the supplier or manufacturer.
   - Country of origin, only where the supplier/manufacturer states it.
   - Datasheet URL (for specifications) and supplier page URL.
3. **Brand permissions and assets**
   - Which brands AB Tech is authorised to sell.
   - Logo files AB Tech is licensed to publish, plus the logo usage rules.
4. **Product photography**
   - Supplier or manufacturer images with permission to publish, and the
     preferred image sizes.

## Import rules that will be applied

- One row per verified SKU; no duplicates against existing slugs.
- No price from a competitor; selling prices come from AB Tech's own pricing
  decision on top of supplier cost.
- Stock is imported only from a supplier stock figure, never estimated.
- `origin` stays empty unless the supplier/manufacturer documents it.
- Warranty stays empty unless documented.
- Brands are created only for products we actually stock or are authorised to
  sell; brand/category links come from those products, not from a competitor's
  navigation.

## Database steps waiting for approval

1. Apply `supabase/migrations/0007_categories_taxonomy.sql` (already prepared;
   replaces the five legacy categories with the approved fourteen).
2. Apply `supabase/migrations/0008_catalogue_presentation.sql` (prepared; adds
   category hierarchy/presentation fields, brand/category links and product
   `origin` / `source_url`). Rollback:
   `supabase/rollback/0008_catalogue_presentation_rollback.sql`.
3. Populate brands, brand/category links and products from the verified data
   above — only after steps 1 and 2 are verified.

Until step 1 is applied, the live storefront keeps showing the five legacy
categories, with the new category hero, icons and filter behaviour working on
that data. Until step 2 is applied, hierarchy, category descriptions, brand
rows and origin stay hidden or fall back to built-in copy.
