"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight, Headphones, RotateCcw, Truck } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import { ASSET } from "@/lib/products";
import { categoryArt } from "@/lib/category-art";
import { categoryIcon } from "@/lib/category-icons";
import { useShop } from "@/lib/shop-store";
import CategoryPanel from "@/components/CategoryPanel";

export type HomeSlide = {
  image: string;
  /** Optional mobile crop. Falls back to the desktop image with a focal point. */
  mobileImage?: string;
  /** CSS object-position for the desktop slide (defaults to center). */
  focusDesktop?: string;
  /** CSS object-position for the mobile slide (defaults to the desktop value). */
  focusMobile?: string;
  kicker: string;
  title: string;
  desc: string;
  href: string;
  ctaLabel: string;
};

type Slide = {
  image: string;
  mobileImage?: string;
  focusDesktop?: string;
  focusMobile?: string;
  kicker: string;
  title: string;
  desc: string;
  href?: string;
  /** Preferred category key plus a label matcher resolved against the live catalogue. */
  category?: { key: string; pattern: RegExp };
  /** Button label; defaults to “Shop now”. */
  cta?: string;
};

const fallbackSlides: Slide[] = [
  {
    image: `${ASSET}/h-electro-pulse-slide-1.webp`,
    kicker: "WELCOME TO AB TECH",
    title: "Latest Tech, One Store",
    desc: "Phones, laptops, tablets and audio — browse the full catalogue.",
    href: "/shop",
    // The artwork places the product on the right, so the narrow mobile crop
    // keeps that side instead of centring on empty background.
    focusMobile: "right center"
  },
  {
    image: `${ASSET}/h-electro-pulse-slide-2.webp`,
    kicker: "LAPTOPS & PCs",
    title: "Power for Work & Study",
    desc: "Compare models, specs and prices across our laptop range.",
    category: { key: "computers", pattern: /computer|laptop|pc|mac/i },
    focusMobile: "right center"
  },
  {
    image: `${ASSET}/h-electro-pulse-slide-3.webp`,
    kicker: "AUDIO & ACCESSORIES",
    title: "Sound That Goes With You",
    desc: "Headphones, speakers and everyday accessories.",
    category: { key: "multimedia", pattern: /audio|multimedia|headphone|speaker/i },
    focusMobile: "right center"
  }
];

/**
 * Home page body. Moved here from `app/page.tsx` so the route can stay a server
 * component that verifies the catalogue before rendering. Client-side because
 * the hero slider, tabbed product rows and carousels are interactive and read
 * the catalogue from the shared shop store.
 */
export default function HomeView({
  slides: managedSlides = [],
  featuredSlugs = [],
  discoverySlugs = []
}: {
  slides?: HomeSlide[];
  /** Curated products or the server's diverse fallback selection. */
  featuredSlugs?: string[];
  /** Wider category-diverse selection, disjoint from featuredSlugs. */
  discoverySlugs?: string[];
}) {
  const { products, categories: catalogCategories } = useShop();

  /**
   * Owner-managed hero banners come from the database. When none are published
   * (or migration 0009 is not applied yet) the built-in slides below keep the
   * homepage working exactly as before.
   */
  const slides: Slide[] = managedSlides.length
    ? managedSlides.map(banner => ({
        image: banner.image,
        kicker: banner.kicker,
        title: banner.title,
        desc: banner.desc,
        href: banner.href,
        cta: banner.ctaLabel,
        mobileImage: banner.mobileImage,
        focusDesktop: banner.focusDesktop,
        focusMobile: banner.focusMobile
      }))
    : fallbackSlides;

  /**
   * Category links follow the catalogue that is actually loaded. The live
   * database taxonomy is still the pre-0007 one (phones, laptops, tablets,
   * audio, wearables), so a hardcoded post-0007 key would point at an empty
   * filter. Prefer the intended key, fall back to a label match, then to the
   * full catalogue — the same links keep working once 0007 is applied.
   */
  const categoryHref = (preferred: string, pattern: RegExp) => {
    if (catalogCategories.some(c => c.key === preferred)) return `/shop?category=${preferred}`;
    const match = catalogCategories.find(c => pattern.test(c.label) || pattern.test(c.key));
    return match ? `/shop?category=${match.key}` : "/shop";
  };

  // Resolve only the slugs selected on the server; no array-position picks.
  const productsBySlug = (slugs: string[]) =>
    slugs
      .map(slug => products.find(p => p.slug === slug))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));
  const featuredProducts = productsBySlug(featuredSlugs);
  const discoveryProducts = productsBySlug(discoverySlugs);

  /** Applies each slide's focal point as CSS custom properties. */
  const focusStyle = (s: Slide): CSSProperties =>
    ({
      "--focus-desktop": s.focusDesktop ?? "center",
      "--focus-mobile": s.focusMobile ?? s.focusDesktop ?? "center"
    }) as CSSProperties;
  const [slide, setSlide] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const goTo = (next: number) => setSlide((next + slides.length) % slides.length);

  useEffect(() => {
    const timer = window.setInterval(() => setSlide(v => (v + 1) % slides.length), 5200);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <main className="home-main">
      <CategoryPanel />
      <section className="hero site-shell">
        <div
          className="hero-slider"
          onTouchStart={event => {
            const t = event.touches[0];
            touchStart.current = { x: t.clientX, y: t.clientY };
          }}
          onTouchEnd={event => {
            const start = touchStart.current;
            touchStart.current = null;
            if (!start) return;
            const t = event.changedTouches[0];
            const dx = t.clientX - start.x;
            const dy = t.clientY - start.y;
            // Horizontal swipes only, so vertical page scrolling keeps working.
            if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) {
              goTo(dx < 0 ? slide + 1 : slide - 1);
            }
          }}
        >
          {slides.map((s, i) => (
            <div
              className={`hero-slide ${i === slide ? "active" : ""}`}
              key={`${s.title}-${i}`}
              style={focusStyle(s)}
            >
              <picture>
                {s.mobileImage && <source media="(max-width: 760px)" srcSet={s.mobileImage} />}
                <img src={s.image} alt="" />
              </picture>
              <div className="hero-text">
                <span>{s.kicker}</span>
                <h1>{s.title}</h1>
                <p>{s.desc}</p>
                <Link href={s.category ? categoryHref(s.category.key, s.category.pattern) : s.href ?? "/shop"}>
                  {s.cta ?? "Shop now"}
                </Link>
              </div>
            </div>
          ))}
          <button
            className="slider-arrow prev"
            aria-label="Previous slide"
            onClick={() => goTo(slide - 1)}
          >
            <ChevronLeft />
          </button>
          <button
            className="slider-arrow next"
            aria-label="Next slide"
            onClick={() => goTo(slide + 1)}
          >
            <ChevronRight />
          </button>
          <div className="slider-dots">
            {slides.map((_, i) => (
              <button
                key={i}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === slide}
                onClick={() => goTo(i)}
                className={i === slide ? "active" : ""}
              />
            ))}
          </div>
        </div>

        {/* Secondary promo banners — hidden on mobile by CSS, kept on desktop. */}
        <Link className="hero-airfryer promo-tile" href="/shop?sort=discount">
          <img src={`${ASSET}/h-electro-pulse-banner-1.webp`} alt="" />
          <div>
            <span>FEATURED DEALS</span>
            <h2>Everyday Electronics<br />at AB Tech</h2>
            <b>Shop now</b>
          </div>
        </Link>

        <div className="hero-right">
          <Link className="promo-tile side-tile" href={categoryHref("multimedia", /audio|multimedia|headphone|speaker/i)}>
            <img src={`${ASSET}/h-electro-pulse-banner-2.webp`} alt="" />
            <div><span>AUDIO</span><h2>Headphones<br />& Speakers</h2><p>Browse the audio range</p></div>
          </Link>
          <Link className="promo-tile side-tile" href={categoryHref("smartphones", /phone|mobile|smart/i)}>
            <img src={`${ASSET}/h-electro-pulse-banner-3.webp`} alt="" />
            <div><span>MOBILE</span><h2>Phones<br />& Accessories</h2><p>Shop mobile</p></div>
          </Link>
        </div>
      </section>

      {catalogCategories.length > 0 && (
        <section className="category-shortcuts site-shell" aria-labelledby="category-shortcuts-title">
          <div className="shortcut-heading">
            <h2 id="category-shortcuts-title">Shop by category</h2>
            <Link href="/categories">All categories <ChevronRight size={14} /></Link>
          </div>
          <div className="shortcut-rail">
            {catalogCategories.map(category => {
              const Icon = categoryIcon(category.key);
              // Category illustrations replace the icon where original
              // artwork exists; see lib/category-art.ts to swap or add art.
              const art = categoryArt(category.key);
              return (
                <Link
                  key={category.key}
                  className={art ? "shortcut has-art" : "shortcut"}
                  href={`/shop?category=${encodeURIComponent(category.key)}`}
                  title={category.label}
                >
                  {art ? (
                    <span className="shortcut-art" aria-hidden="true">
                      <img
                        src={art.src}
                        alt=""
                        width={art.width}
                        height={art.height}
                        loading="lazy"
                        decoding="async"
                      />
                    </span>
                  ) : (
                    <span className="shortcut-icon" aria-hidden="true">
                      <Icon size={20} strokeWidth={1.8} />
                    </span>
                  )}
                  <span className="shortcut-label">{category.label}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {featuredProducts.length > 0 && (
        <section className="section site-shell">
          <div className="title-line">
            <h2>Featured Products</h2>
            <Link href="/shop">View All <ChevronRight size={15} /></Link>
          </div>
          <div className="deal-grid">
            {featuredProducts.map(product => (
              <ProductCard product={product} showCategory key={product.slug} />
            ))}
          </div>
        </section>
      )}

      {discoveryProducts.length > 0 && (
        <section className="section site-shell">
          <div className="title-line">
            <h2>Explore the catalogue</h2>
            <Link href="/shop">View All <ChevronRight size={15} /></Link>
          </div>
          <div className="best-grid">
            {discoveryProducts.map(product => (
              <ProductCard product={product} showCategory key={product.slug} />
            ))}
          </div>
        </section>
      )}

      <section className="benefits site-shell">
        <div><Truck /><span><strong>Delivery options</strong><small>Standard and express delivery choices with costs shown at checkout.</small></span></div>
        <div><RotateCcw /><span><strong>Returns</strong><small>Need to return an item? Contact our support team and we will help you with the next steps.</small></span></div>
        <div><Headphones /><span><strong>Customer support</strong><small>Questions about an order or a product? Get in touch using the contact details in the footer.</small></span></div>
      </section>
    </main>
  );
}