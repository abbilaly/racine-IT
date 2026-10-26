"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Headphones, RotateCcw, Truck } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import MiniProduct from "@/components/MiniProduct";
import { ASSET } from "@/lib/products";
import { useShop } from "@/lib/shop-store";

const DEMO = "/shop";

const slides = [
  {
    image: `${ASSET}/h-electro-pulse-slide-1.webp`,
    kicker: "BUY 1 GET 1—WATCH!",
    title: "Save! 30-50%",
    desc: "Starting at $175. Hurry up! Do not miss...",
  },
  {
    image: `${ASSET}/h-electro-pulse-slide-2.webp`,
    kicker: "BUY 1 GET 1—DOG FOOD!",
    title: "Up to 50% Off!",
    desc: "Starting at $175. Hurry up! Do not miss...",
  },
  {
    image: `${ASSET}/h-electro-pulse-slide-3.webp`,
    kicker: "BUY 1 GET 1—CAMERA!",
    title: "Flash Sale Alert!",
    desc: "Starting at $175. Hurry up? Do not miss...",
  },
];

const categories: [string, string, string][] = [
  ["Home/Electronics", "h-electro-pulse-cat-1.webp", "/shop"],
  ["Macbook/PCs", "h-electro-pulse-cat-2.webp", "/shop?category=laptops"],
  ["Phone/Mobile", "h-electro-pulse-cat-3.webp", "/shop?category=phones"],
  ["Tablets/Ipad Pro", "h-electro-pulse-cat-4.webp", "/shop?category=tablets"],
  ["Camera/Photo", "h-electro-pulse-cat-5.webp", "/shop?category=audio"],
  ["Home/Electronics", "h-electro-pulse-cat-6.webp", "/shop"],
  ["Macbook/PCs", "h-electro-pulse-cat-7.webp", "/shop?category=laptops"],
  ["Camera/Photo", "h-electro-pulse-cat-8.webp", "/shop"],
];

export default function Home() {
  const { products } = useShop();
  // The catalogue can change at runtime, so pick by index defensively.
  const pick = (indexes: number[]) =>
    indexes
      .map(i => products[i])
      .filter((p): p is NonNullable<typeof p> => Boolean(p));
  const popularPicks = pick([5, 6, 0, 3]);
  const highlightPicks = pick([11, 9, 6]);
  const [slide, setSlide] = useState(1);
  const [copied, setCopied] = useState(false);

  const copyCoupon = async () => {
    try { await navigator.clipboard.writeText("CODE6789"); } catch { /* clipboard unavailable */ }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1300);
  };

  useEffect(() => {
    const timer = window.setInterval(() => setSlide(v => (v + 1) % slides.length), 5200);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <main>
      <section className="hero site-shell">
        <div className="hero-slider">
          {slides.map((s, i) => (
            <div className={`hero-slide ${i === slide ? "active" : ""}`} key={s.title}>
              <img src={s.image} alt="" />
              <div className="hero-text">
                <span>{s.kicker}</span>
                <h1>{s.title}</h1>
                <p>{s.desc}</p>
                <Link href="/shop?sort=discount">Shop Save</Link>
              </div>
            </div>
          ))}
          <button
            className="slider-arrow prev"
            aria-label="Previous slide"
            onClick={() => setSlide((slide + slides.length - 1) % slides.length)}
          >
            <ChevronLeft />
          </button>
          <button
            className="slider-arrow next"
            aria-label="Next slide"
            onClick={() => setSlide((slide + 1) % slides.length)}
          >
            <ChevronRight />
          </button>
          <div className="slider-dots">
            {slides.map((_, i) => (
              <button
                key={i}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === slide}
                onClick={() => setSlide(i)}
                className={i === slide ? "active" : ""}
              />
            ))}
          </div>
        </div>

        <Link className="hero-airfryer promo-tile" href="/shop?sort=discount">
          <img src={`${ASSET}/h-electro-pulse-banner-1.webp`} alt="" />
          <div>
            <span>SAVE 30—50% ELECTRONICS</span>
            <h2>Air Fryer<br />Save Up To $159</h2>
            <b>Shop Sale</b>
          </div>
        </Link>

        <div className="hero-right">
          <Link className="promo-tile side-tile" href="/shop?category=audio">
            <img src={`${ASSET}/h-electro-pulse-banner-2.webp`} alt="" />
            <div><span>APPLE BRAND</span><h2>Buy 1 Get 1<br />Ipod 5</h2><p>Starting at <strong>$135</strong></p></div>
          </Link>
          <Link className="promo-tile side-tile" href="/shop?category=audio">
            <img src={`${ASSET}/h-electro-pulse-banner-3.webp`} alt="" />
            <div><span>SAMSUNG BRAND</span><h2>Sale 30%<br />Headphones</h2><p>Starting at <strong>$95</strong></p></div>
          </Link>
        </div>
      </section>

      <section className="category-row site-shell">
        {categories.map(([name, image, href]) => (
          <Link className="category-item" key={image} href={href}>
            <div className="category-image"><img src={`${ASSET}/${image}`} alt="" loading="lazy" /></div>
            <h3>{name} <span>14</span></h3>
            <b>›</b>
          </Link>
        ))}
      </section>

      <section className="section site-shell">
        <div className="deals-heading">
          <h2>Today&apos;s Best Deals</h2>
          <div className="offer-end"><span>Hurry up! Offer ends in:</span><b>856</b><b>59</b><b>40</b><b>09</b></div>
        </div>
        <div className="deal-grid">
          {products.slice(0, 7).map(p => <ProductCard product={p} key={p.slug} />)}
        </div>
      </section>

      <section className="voucher site-shell">
        <div>
          <span>Big Promotion</span>
          <h2>Grab Your Vouchers!</h2>
          <p>Up to 35% Off everything code.<br />Limited time only. Excludes selected lines.</p>
        </div>
        <button onClick={copyCoupon} className="coupon">
          <strong>CODE6789</strong>
          <small>{copied ? "Copied" : "Copy"}</small>
        </button>
        <Link className="voucher-shop" href="/shop?sort=discount">Shop Sale</Link>
      </section>

      <section className="section site-shell">
        <div className="title-line"><h2>Popular Picks</h2><Link href="/shop">View All <ChevronRight size={15} /></Link></div>
        <div className="popular-grid">
          <div className="popular-products">
            {popularPicks.map(p => (
              <MiniProduct product={p} key={p.slug} />
            ))}
          </div>
          <Link className="wide-promo desert" href="/shop?category=tablets">
            <img src={`${ASSET}/h-electro-pulse-banner-4.webp`} alt="" loading="lazy" />
            <div><span>NEW COLLECTION</span><h2>Ipad Pro Ultra 15.6&quot;</h2><p>Starting at $159. Hurry up! Do not miss...</p><b>Shop Sale</b></div>
          </Link>
        </div>
      </section>

      <section className="promo-mosaic site-shell">
        <Link className="mosaic-card" href="/shop?category=laptops">
          <img src={`${ASSET}/h-electro-pulse-banner-5.webp`} alt="" loading="lazy" />
          <div><span>APPLE BRAND</span><h2>Macbook M4</h2><p>Starting at $1.579.99</p><b>View All</b></div>
        </Link>
        <Link className="mosaic-card" href="/shop?sort=discount">
          <img src={`${ASSET}/h-electro-pulse-banner-6.webp`} alt="" loading="lazy" />
          <div><span>SAVE 30—50% ELECTRONICS</span><h2>Limited Edition</h2><b>View All</b></div>
        </Link>
        <Link className="mosaic-card wide" href="/shop?category=audio">
          <img src={`${ASSET}/h-electro-pulse-banner-7.webp`} alt="" loading="lazy" />
          <div><h2>Speaker Save Up To $178</h2><p>Limited Time: Online Only!</p><b>Shop Now</b></div>
        </Link>
        <Link className="mosaic-card wide" href="/shop?category=laptops">
          <img src={`${ASSET}/h-electro-pulse-banner-8.webp`} alt="" loading="lazy" />
          <div><span>SAVE 40—50% ELECTRONICS</span><h2>Limited Edition</h2><p>Choose the right laptop screen for the best experience.</p><b>Shop Now</b></div>
        </Link>
      </section>

      <section className="section site-shell">
        <div className="title-line"><h2>Best Selling</h2><Link href="/shop?sort=rating">View All <ChevronRight size={15} /></Link></div>
        <div className="best-grid">
          {products.slice(7, 12).map(p => <ProductCard product={p} key={p.slug} />)}
        </div>
      </section>

      <section className="section site-shell brands-section">
        <div className="title-line"><h2>Featured Brands</h2><Link href="/shop">View All <ChevronRight size={15} /></Link></div>
        <div className="brand-grid">
          {[1, 2, 3, 4, 5].map(n => (
            <Link key={n} href="/shop"><img src={`${ASSET}/h-electro-pulse-brand-${n}.webp`} alt="" loading="lazy" /></Link>
          ))}
        </div>
      </section>

      <section className="highlight site-shell">
        <div className="highlight-slider">
          <img src={`${ASSET}/h-electro-pulse-hightlight-1.webp`} alt="" loading="lazy" />
          <div className="highlight-copy">
            <span>Save 30—50% electronics</span>
            <h2>Small Size Big Sound</h2>
            <p>A mini speaker with powerful and dynamic sound. Compact and portable, perfect for any space and easy to carry anywhere.</p>
            <Link href="/shop?category=audio">Shop Now</Link>
          </div>
        </div>
        <div className="highlight-products">
          {highlightPicks.map(p => (
            <MiniProduct product={p} key={p.slug} />
          ))}
        </div>
      </section>

      <section className="benefits site-shell">
        <div><Truck /><span><strong>Free Shipping</strong><small>Enjoy free worldwide shipping and returns, with customs and duties taxes included.</small></span></div>
        <div><RotateCcw /><span><strong>Free Returns</strong><small>Free returns within 15 days, please make sure the items are in undamaged condition.</small></span></div>
        <div><Headphones /><span><strong>Support Online</strong><small>We support customers 24/7, send questions we will solve for you immediately.</small></span></div>
      </section>
    </main>
  );
}
