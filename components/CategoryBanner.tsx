import Link from "next/link";
import { categoryIcon } from "@/lib/category-icons";
import { imageUrl } from "@/lib/products";

export type CategoryBannerLink = {
  label: string;
  href: string;
  count?: number;
  active?: boolean;
};

type Props = {
  slug: string;
  label: string;
  description: string;
  /** Operator-chosen icon key from `categories.icon` (0008), if any. */
  icon?: string | null;
  image?: string | null;
  total: number;
  subcategories: CategoryBannerLink[];
  brands: CategoryBannerLink[];
  allBrandsHref: string;
};

/**
 * Category landing hero, modelled on the ElectroPulse category pages: a wide
 * banner with the category name and blurb, followed by subcategory shortcuts
 * and a brand row that filters within the category.
 *
 * Only real catalogue data is shown. The banner image is the primary image of a
 * product in that category (or `categories.banner_path` after migration 0008);
 * the brand row is empty until brands are actually assigned to products.
 */
export default function CategoryBanner({
  slug,
  label,
  description,
  icon,
  image,
  total,
  subcategories,
  brands,
  allBrandsHref
}: Props) {
  const Icon = categoryIcon(slug, icon);
  const noBrandSelected = brands.every(brand => !brand.active);

  return (
    <div className="category-hero-wrap">
      <section
        className={`category-hero${image ? " has-image" : ""}`}
        aria-labelledby="category-hero-title"
      >
        {image ? (
          <div className="category-hero__media" aria-hidden="true">
            <img src={imageUrl(image)} alt="" />
          </div>
        ) : null}

        <div className="category-hero__body">
          <span className="category-hero__eyebrow">
            <Icon size={15} strokeWidth={1.8} aria-hidden="true" />
            Category
          </span>
          <h1 id="category-hero-title">{label}</h1>
          <p>{description}</p>
          <span className="category-hero__count">
            {total} product{total === 1 ? "" : "s"} listed
          </span>
        </div>
      </section>

      {subcategories.length > 0 ? (
        <nav className="category-subnav" aria-label={`${label} subcategories`}>
          {subcategories.map(item => (
            <Link key={item.label} href={item.href} className="category-subnav__chip">
              {item.label}
              {typeof item.count === "number" ? (
                <span className="category-subnav__count">{item.count}</span>
              ) : null}
            </Link>
          ))}
        </nav>
      ) : null}

      {brands.length > 0 ? (
        <section className="category-brands" aria-labelledby="category-brands-title">
          <h2 id="category-brands-title">Brands in {label}</h2>
          <div className="category-brands__grid">
            <Link
              href={allBrandsHref}
              className={`brand-chip${noBrandSelected ? " is-active" : ""}`}
              aria-current={noBrandSelected ? "true" : undefined}
            >
              All brands
            </Link>
            {brands.map(brand => (
              <Link
                key={brand.label}
                href={brand.href}
                className={`brand-chip${brand.active ? " is-active" : ""}`}
                aria-current={brand.active ? "true" : undefined}
              >
                <span className="brand-chip__mono" aria-hidden="true">
                  {brand.label.charAt(0).toUpperCase()}
                </span>
                <span className="brand-chip__name">{brand.label}</span>
                {typeof brand.count === "number" ? (
                  <span className="brand-chip__count">{brand.count}</span>
                ) : null}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
