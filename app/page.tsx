"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  GitCompareArrows,
  Heart,
  Headphones,
  Menu,
  RotateCcw,
  Search,
  ShoppingBag,
  Truck,
  X
} from "lucide-react";

const DEMO = "https://wpglozin.com/electro/";
const ASSET = "https://wpglozin.com/electro/wp-content/uploads/sites/24/2025/05";
const PAYMENTS = "https://wpglozin.com/electro/wp-content/uploads/sites/24/2025/03/payment.webp";

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
    desc: "Starting at $175. Hurry up! Do not miss...",
  },
];

const categories = [
  ["Home/Electronics", "h-electro-pulse-cat-1.webp"],
  ["Macbook/PCs", "h-electro-pulse-cat-2.webp"],
  ["Phone/Mobile", "h-electro-pulse-cat-3.webp"],
  ["Tablets/Ipad Pro", "h-electro-pulse-cat-4.webp"],
  ["Camera/Photo", "h-electro-pulse-cat-5.webp"],
  ["Home/Electronics", "h-electro-pulse-cat-6.webp"],
  ["Macbook/PCs", "h-electro-pulse-cat-7.webp"],
  ["Camera/Photo", "h-electro-pulse-cat-8.webp"],
] as const;

type Product = {
  title: string;
  image: string;
  hover: string;
  old?: string;
  price: string;
  badge?: string;
};

const products: Product[] = [
  {
    title: "Apple iPhone 13 Mini 128GB Pink– Unlocked (Renewed)",
    image: "products_digital_1_1-min.webp",
    hover: "products_digital_1_2-min-400x400.webp",
    old: "$195.00",
    price: "$175.00",
    badge: "-10%",
  },
  {
    title: "Apple Watch Aluminum Case – Pride Edition New 2024",
    image: "products_digital_2_1-min.webp",
    hover: "products_digital_2_2-min-400x400.webp",
    old: "$195.00",
    price: "$175.00",
    badge: "-10%",
  },
  {
    title: "Apple iPad Pro M1 12-inch 2022 Wi-Fi 128GB – Blue",
    image: "products_digital_3_1-min.webp",
    hover: "products_digital_3_2-min-400x400.webp",
    old: "$195.00",
    price: "$175.00",
    badge: "-10%",
  },
  {
    title: "Valdus Round Smart Watch Blood Pressure – Dark Blue",
    image: "products_digital_4_1-min.webp",
    hover: "products_digital_4_2-min-400x400.webp",
    old: "$175.00",
    price: "$150.00",
    badge: "-14%",
  },
  {
    title: "Apple iPad Pro M1 11-inch 2021 Wi-Fi 128GB – Black",
    image: "products_digital_5_1-min.webp",
    hover: "products_digital_5_2-min-400x400.webp",
    old: "$175.00",
    price: "$150.00",
    badge: "-14%",
  },
  {
    title: "2024 Proove Wireless Headset Gaming Bliss – White",
    image: "products_digital_6_1-min.webp",
    hover: "products_digital_6_2-min-400x400.webp",
    old: "$175.00",
    price: "$150.00",
    badge: "-14%",
  },
  {
    title: "Hot Sales For Original MacBooks Pro 16 M3 Gray 2025",
    image: "products_digital_7_1-min.webp",
    hover: "products_digital_7_2-min-400x400.webp",
    old: "$195.00",
    price: "$175.00",
    badge: "-10%",
  },
  {
    title: "Apple iPhone 13 Mini 128GB Blue – Unlocked (Renewed)",
    image: "products_digital_8_1-min.webp",
    hover: "products_digital_8_2-min-400x400.webp",
    price: "$175.00",
  },
  {
    title: "Apple AirPods 3 2022 Bluetooth Headset – Unlocked",
    image: "products_digital_9_1-min.webp",
    hover: "products_digital_9_2-min-400x400.webp",
    price: "$150.00",
  },
  {
    title: "Hot Sales For Original MacBooks Pro 16 M2 – Gray Color",
    image: "products_digital_10_1-min.webp",
    hover: "products_digital_10_2-min-400x400.webp",
    old: "$2,499.00",
    price: "$2,399.00",
    badge: "-4%",
  },
  {
    title: "Apple iPhone 13 Mini 128GB White–Unlocked (Renewed)",
    image: "products_digital_11_1-min.webp",
    hover: "products_digital_11_2-min-400x400.webp",
    price: "$150.00",
  },
  {
    title: "Portable Wireless Speakers Music Speakers New 2025",
    image: "products_digital_12_1-min_440c4ce0-1c9b-491b-ad23-41bd1de013fe.webp",
    hover: "products_digital_12_2-min_f6726fbb-a322-4e34-8bd1-65436e926f59-400x400.webp",
    old: "$148.00",
    price: "$135.00",
    badge: "-9%",
  },
];

function ProductCard({ product, onAdd }: { product: Product; onAdd: () => void }) {
  return (
    <article className="product-card">
      <div className="product-media">
        {product.badge && <span className="sale-badge">{product.badge}</span>}
        <div className="hover-actions">
          <button aria-label="Add to wishlist"><Heart size={17} /></button>
          <button aria-label="Compare"><GitCompareArrows size={17} /></button>
        </div>
        <img className="product-primary" src={`${ASSET}/${product.image}`} alt={product.title} />
        <img className="product-secondary" src={`${ASSET}/${product.hover}`} alt="" />
        <button className="quick-add" onClick={onAdd}>Add to Cart</button>
      </div>
      <div className="product-copy">
        <a href={DEMO} target="_blank" rel="noreferrer">{product.title}</a>
        <div className="rating">★★★★★</div>
        <div className="price-line">
          {product.old && <del>{product.old}</del>}
          <strong>{product.price}</strong>
        </div>
      </div>
    </article>
  );
}

function MiniProduct({ product }: { product: Product }) {
  return (
    <div className="mini-product">
      <img src={`${ASSET}/${product.image}`} alt={product.title} />
      <div>
        <a href={DEMO}>{product.title}</a>
        <div className="mini-rating">★★★★★</div>
        <p>{product.old && <del>{product.old}</del>} <strong>{product.price}</strong></p>
      </div>
    </div>
  );
}

export default function Home() {
  const [slide, setSlide] = useState(1);
  const [cart, setCart] = useState(0);
  const [mobile, setMobile] = useState(false);
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setSlide(v => (v + 1) % slides.length), 5200);
    return () => window.clearInterval(timer);
  }, []);

  const dealProducts = useMemo(
    () => products.slice(0, 7).filter(p => p.title.toLowerCase().includes(query.toLowerCase())),
    [query]
  );

  const copyCoupon = async () => {
    try { await navigator.clipboard.writeText("CODE6789"); } catch {}
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1300);
  };

  return (
    <main>
      <div className="promo-bar">
        <div className="site-shell promo-inner">
          <span>Sign up for 10% off your first order. <b>Sign Up</b></span>
          <span>Summer sale discount off 50%. <b>Shop Sale</b></span>
          <span>Coats—every friday 75% Off. <b>Shop Sale</b></span>
        </div>
      </div>

      <div className="topbar">
        <div className="site-shell topbar-inner">
          <div><a>Help Center</a><a>About Us</a><a>Our Stores</a></div>
          <div><span>🇺🇸 United States (USD $) <ChevronDown size={12}/></span><span>English <ChevronDown size={12}/></span></div>
        </div>
      </div>

      <header className="main-header">
        <div className="site-shell header-inner">
          <button className="mobile-menu-button" onClick={() => setMobile(v => !v)} aria-label="Toggle menu">
            {mobile ? <X /> : <Menu />}
          </button>
          <a href="#" className="glozin-logo">
            <img src={`${ASSET}/logo-digital.svg`} alt="Glozin Electro Pulse WordPress Theme" />
          </a>
          <label className="search-field">
            <Search size={18} />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="I'm looking for..." />
          </label>
          <div className="account-area">
            <button><CircleUserRound /><span>Login<br/><small>Register</small></span></button>
            <button className="round-action"><Heart /><i>0</i></button>
            <button className="cart-button"><ShoppingBag /><i>{cart}</i><span>Cart<br/><small>$0.00</small></span></button>
          </div>
        </div>
      </header>

      <nav className={`main-nav ${mobile ? "mobile-open" : ""}`}>
        <div className="site-shell nav-inner">
          <div className="nav-links">
            <a>Home <ChevronDown size={13}/></a>
            <a>Shop <ChevronDown size={13}/></a>
            <a>Products <ChevronDown size={13}/></a>
            <a>Pages <ChevronDown size={13}/></a>
            <a>Blog <ChevronDown size={13}/></a>
            <a className="sale-nav">Sale <b>HOT</b></a>
            <a>Buy Theme!</a>
          </div>
          <a className="recent-link">◷ Recently View Products</a>
        </div>
      </nav>

      <section className="hero site-shell">
        <div className="hero-slider">
          {slides.map((s, i) => (
            <div className={`hero-slide ${i === slide ? "active" : ""}`} key={s.title}>
              <img src={s.image} alt="" />
              <div className="hero-text">
                <span>{s.kicker}</span>
                <h1>{s.title}</h1>
                <p>{s.desc}</p>
                <a href={DEMO}>Shop Save</a>
              </div>
            </div>
          ))}
          <button className="slider-arrow prev" onClick={() => setSlide((slide + slides.length - 1) % slides.length)}><ChevronLeft /></button>
          <button className="slider-arrow next" onClick={() => setSlide((slide + 1) % slides.length)}><ChevronRight /></button>
          <div className="slider-dots">
            {slides.map((_, i) => <button key={i} onClick={() => setSlide(i)} className={i === slide ? "active" : ""} />)}
          </div>
        </div>

        <a className="hero-airfryer promo-tile" href={DEMO}>
          <img src={`${ASSET}/h-electro-pulse-banner-1.webp`} alt="" />
          <div>
            <span>SAVE 30—50% ELECTRONICS</span>
            <h2>Air Fryer<br/>Save Up To $159</h2>
            <b>Shop Sale</b>
          </div>
        </a>

        <div className="hero-right">
          <a className="promo-tile side-tile" href={DEMO}>
            <img src={`${ASSET}/h-electro-pulse-banner-2.webp`} alt="" />
            <div><span>APPLE BRAND</span><h2>Buy 1 Get 1<br/>Ipod 5</h2><p>Starting at <strong>$135</strong></p></div>
          </a>
          <a className="promo-tile side-tile" href={DEMO}>
            <img src={`${ASSET}/h-electro-pulse-banner-3.webp`} alt="" />
            <div><span>SAMSUNG BRAND</span><h2>Sale 30%<br/>Headphones</h2><p>Starting at <strong>$95</strong></p></div>
          </a>
        </div>
      </section>

      <section className="category-row site-shell">
        {categories.map(([name, image]) => (
          <a className="category-item" key={image} href={DEMO}>
            <div className="category-image"><img src={`${ASSET}/${image}`} alt="" /></div>
            <h3>{name} <span>14</span></h3>
            <b>›</b>
          </a>
        ))}
      </section>

      <section className="section site-shell">
        <div className="deals-heading">
          <h2>Today&apos;s Best Deals</h2>
          <div className="offer-end"><span>Hurry up! Offer ends in:</span><b>856</b><b>59</b><b>40</b><b>09</b></div>
        </div>
        <div className="deal-grid">
          {dealProducts.map((p, i) => <ProductCard product={p} key={i} onAdd={() => setCart(v => v + 1)} />)}
        </div>
      </section>

      <section className="voucher site-shell">
        <div>
          <span>Big Promotion</span>
          <h2>Grab Your Vouchers!</h2>
          <p>Up to 35% Off everything code.<br/>Limited time only. Excludes selected lines.</p>
        </div>
        <button onClick={copyCoupon} className="coupon">
          <strong>CODE6789</strong>
          <small>{copied ? "Copied" : "Copy"}</small>
        </button>
        <a href={DEMO}>Shop Sale</a>
      </section>

      <section className="section site-shell">
        <div className="title-line"><h2>Popular Picks</h2><a>View All <ChevronRight size={15}/></a></div>
        <div className="popular-grid">
          <div className="popular-products">
            <MiniProduct product={products[5]} />
            <MiniProduct product={products[6]} />
            <MiniProduct product={products[0]} />
            <MiniProduct product={products[3]} />
          </div>
          <a className="wide-promo desert" href={DEMO}>
            <img src={`${ASSET}/h-electro-pulse-banner-4.webp`} alt="" />
            <div><span>NEW COLLECTION</span><h2>Ipad Pro Ultra 15.6&quot;</h2><p>Starting at $159. Hurry up! Do not miss...</p><b>Shop Sale</b></div>
          </a>
        </div>
      </section>

      <section className="promo-mosaic site-shell">
        <a className="mosaic-card" href={DEMO}>
          <img src={`${ASSET}/h-electro-pulse-banner-5.webp`} alt="" />
          <div><span>APPLE BRAND</span><h2>Macbook M4</h2><p>Starting at $1.579.99</p><b>View All</b></div>
        </a>
        <a className="mosaic-card" href={DEMO}>
          <img src={`${ASSET}/h-electro-pulse-banner-6.webp`} alt="" />
          <div><span>SAVE 30—50% ELECTRONICS</span><h2>Limited Edition</h2><b>View All</b></div>
        </a>
        <a className="mosaic-card wide" href={DEMO}>
          <img src={`${ASSET}/h-electro-pulse-banner-7.webp`} alt="" />
          <div><h2>Speaker Save Up To $178</h2><p>Limited Time: Online Only!</p><b>Shop Now</b></div>
        </a>
        <a className="mosaic-card wide" href={DEMO}>
          <img src={`${ASSET}/h-electro-pulse-banner-8.webp`} alt="" />
          <div><span>SAVE 40—50% ELECTRONICS</span><h2>Limited Edition</h2><p>Choose the right laptop screen for the best experience.</p><b>Shop Now</b></div>
        </a>
      </section>

      <section className="section site-shell">
        <div className="title-line"><h2>Best Selling</h2><a>View All <ChevronRight size={15}/></a></div>
        <div className="best-grid">
          {products.slice(7, 12).map((p, i) => <ProductCard product={p} key={i} onAdd={() => setCart(v => v + 1)} />)}
        </div>
      </section>

      <section className="section site-shell brands-section">
        <div className="title-line"><h2>Featured Brands</h2><a>View All <ChevronRight size={15}/></a></div>
        <div className="brand-grid">
          {[1,2,3,4,5].map(n => <a key={n} href={DEMO}><img src={`${ASSET}/h-electro-pulse-brand-${n}.webp`} alt="" /></a>)}
        </div>
      </section>

      <section className="highlight site-shell">
        <div className="highlight-slider">
          <img src={`${ASSET}/h-electro-pulse-hightlight-1.webp`} alt="" />
          <div className="highlight-copy">
            <span>Save 30—50% electronics</span>
            <h2>Small Size Big Sound</h2>
            <p>A mini speaker with powerful and dynamic sound. Compact and portable, perfect for any space and easy to carry anywhere.</p>
            <a href={DEMO}>Shop Now</a>
          </div>
        </div>
        <div className="highlight-products">
          <MiniProduct product={products[11]} />
          <MiniProduct product={products[9]} />
          <MiniProduct product={products[6]} />
        </div>
      </section>

      <section className="benefits site-shell">
        <div><Truck/><span><strong>Free Shipping</strong><small>Enjoy free worldwide shipping and returns, with customs and duties taxes included.</small></span></div>
        <div><RotateCcw/><span><strong>Free Returns</strong><small>Free returns within 15 days, please make sure the items are in undamaged condition.</small></span></div>
        <div><Headphones/><span><strong>Support Online</strong><small>We support customers 24/7, send questions we will solve for you immediately.</small></span></div>
      </section>

      <footer className="footer">
        <div className="site-shell footer-grid">
          <div className="support-column">
            <span>HELP CENTER</span>
            <h2>Online Suport 24/7</h2>
            <p><b>Call Us</b><br/>Call now +222-1800-2628</p>
            <p><b>Chat with Us</b><br/>Chat now with an expert</p>
            <p><b>Email Us</b><br/>support@example.com</p>
          </div>
          <div><h3>About The Store</h3><p>Trusted by 5.9 Million American**. We always try to bring the best experience to customers when shopping at Glozin.</p><p>+1 (973) 435-3638</p><p>support@example.com</p></div>
          <div><h3>Our Company</h3><a>Terms Of Use</a><a>Privacy Policy</a><a>About Us</a><a>Contact Us</a><a>FAQ</a><a>Store Location</a></div>
          <div><h3>Shop Categories</h3><a>Hot Deals</a><a>Best Seller</a><a>Sale & Special Offers</a><a>Macbook/PCs</a><a>Popular Trends</a><a>Tablets/Ipad Pro</a></div>
          <div><h3>Sign Up to Newsletter</h3><p>Sign up for 10% off your first purchase and free shipping. Updates information on Sales and Offers.</p><label><input placeholder="Enter your email address"/><button>Subscribe</button></label></div>
        </div>
        <div className="site-shell footer-bottom">
          <span>© 2026 Glozin. All Rights Reserved.</span>
          <img src={PAYMENTS} alt="Payment methods" />
        </div>
      </footer>
    </main>
  );
}
