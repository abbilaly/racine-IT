"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  CircleUserRound,
  GitCompareArrows,
  Heart,
  Menu,
  Search,
  ShoppingBag,
  Truck,
  RotateCcw,
  Headphones,
  Copy,
  Check,
  X,
  ArrowRight,
  Camera,
  Gamepad2,
  HeadphonesIcon,
  Keyboard,
  Laptop,
  MonitorSmartphone,
  Printer,
  Smartphone,
  Watch
} from "lucide-react";

const demo = "https://wpglozin.com/electro";
const asset = "https://wpglozin.com/electro/wp-content/uploads/sites/24/2025";
const heroImages = [
  asset + "/05/h-electro-pulse-hightlight-1.webp",
  asset + "/05/h-electro-pulse-hightlight-2.webp",
  asset + "/05/h-electro-pulse-hightlight-3.webp"
];

const categories = [
  { name: "Home/Electronics", icon: MonitorSmartphone },
  { name: "Macbook/PCs", icon: Laptop },
  { name: "Phone/Mobile", icon: Smartphone },
  { name: "Tablets/iPad Pro", icon: MonitorSmartphone },
  { name: "Camera/Photo", icon: Camera },
  { name: "Printer & Cameras", icon: Printer },
  { name: "Keyboard & Mouse", icon: Keyboard },
  { name: "Video Games", icon: Gamepad2 }
];

const products = [
  { title: "Apple iPhone 13 Mini 128GB Pink– Unlocked (Renewed)", old: "$195.00", price: "$175.00", badge: "-10%", image: heroImages[0] },
  { title: "Apple Watch Aluminum Case – Pride Edition New 2024", old: "$195.00", price: "$175.00", badge: "-10%", image: heroImages[1] },
  { title: "Apple iPad Pro M1 12-inch 2022 Wi-Fi 128GB – Blue", old: "$195.00", price: "$175.00", badge: "-10%", image: heroImages[2] },
  { title: "Valdus Round Smart Watch Blood Pressure – Dark Blue", old: "$175.00", price: "$150.00", badge: "-14%", image: heroImages[1] },
  { title: "Apple iPad Pro M1 11-inch 2021 Wi-Fi 128GB – Black", old: "$175.00", price: "$150.00", badge: "-14%", image: heroImages[2] },
  { title: "2024 Proove Wireless Headset Gaming Bliss – White", old: "$175.00", price: "$150.00", badge: "-14%", image: heroImages[0] },
  { title: "Hot Sales For Original MacBooks Pro 16 M3 Gray 2025", old: "$195.00", price: "$175.00", badge: "-10%", image: heroImages[2] }
];

function ProductCard({ product, onAdd }: { product: (typeof products)[number]; onAdd: () => void }) {
  return (
    <article className="product-card">
      <div className="product-media">
        <span className="discount">{product.badge}</span>
        <div className="product-actions">
          <button aria-label="Wishlist"><Heart size={17} /></button>
          <button aria-label="Compare"><GitCompareArrows size={17} /></button>
        </div>
        <img src={product.image} alt="" />
      </div>
      <div className="product-info">
        <a href={demo} target="_blank" rel="noreferrer">{product.title}</a>
        <div className="prices"><del>{product.old}</del><strong>{product.price}</strong></div>
        <button className="add-btn" onClick={onAdd}>Add to Cart</button>
      </div>
    </article>
  );
}

export default function Home() {
  const [cart, setCart] = useState(0);
  const [copied, setCopied] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () => products.filter(p => p.title.toLowerCase().includes(query.toLowerCase())),
    [query]
  );

  const copyCoupon = async () => {
    try { await navigator.clipboard.writeText("CODE6789"); } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <main>
      <div className="announcement">
        <span>Sign up for 10% off your first order. <b>Sign Up</b></span>
        <span className="announce-center">Summer sale discount off 50%. <b>Shop Sale</b></span>
        <span>Coats—every friday 75% Off. <b>Shop Sale</b></span>
      </div>

      <div className="utility shell">
        <div className="utility-links"><a>Help Center</a><a>About Us</a><a>Our Stores</a></div>
        <div className="utility-links"><span>United States (USD $)</span><span>English</span></div>
      </div>

      <header className="header shell">
        <button className="mobile-toggle" onClick={() => setMobileOpen(v => !v)} aria-label="Menu">
          {mobileOpen ? <X /> : <Menu />}
        </button>
        <a className="logo" href="#">Glozin<span>.</span></a>
        <label className="searchbox">
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="I'm looking for…" />
          <Search size={21} />
        </label>
        <div className="header-actions">
          <button><CircleUserRound /><span>Login<br/><small>Register</small></span></button>
          <button className="icon-button"><Heart /><i>0</i></button>
          <button className="cart-action"><ShoppingBag /><span><b>{cart}</b> Cart<br/><small>$0.00</small></span></button>
        </div>
      </header>

      <nav className={"nav " + (mobileOpen ? "nav-open" : "")}>
        <div className="shell nav-inner">
          <button className="category-button"><Menu size={18}/> Product Categories <ChevronDown size={16}/></button>
          <a href="#">Home <ChevronDown size={14}/></a>
          <a href="#">Shop <ChevronDown size={14}/></a>
          <a href="#">Products <ChevronDown size={14}/></a>
          <a href="#">Pages <ChevronDown size={14}/></a>
          <a href="#">Blog</a>
          <a href="#" className="sale-link">Sale <span>Hot</span></a>
        </div>
      </nav>

      <section className="hero shell">
        <div className="hero-main">
          <div className="hero-copy">
            <span className="eyebrow">NEW COLLECTION</span>
            <h1>Smart Tech.<br/>Better Living.</h1>
            <p>Discover powerful devices made for work, play and everything in between.</p>
            <a className="dark-btn" href={demo} target="_blank" rel="noreferrer">Shop Now <ArrowRight size={17}/></a>
          </div>
          <img src={heroImages[0]} alt="" />
        </div>
        <div className="hero-stack">
          <div className="hero-small lime">
            <div><small>NEW 2025</small><h2>Big Sound.<br/>Small Size.</h2><a href={demo}>Shop now <ChevronRight size={15}/></a></div>
            <img src={heroImages[1]} alt="" />
          </div>
          <div className="hero-small pale">
            <div><small>UP TO 35% OFF</small><h2>Work Smarter<br/>Everywhere.</h2><a href={demo}>Shop now <ChevronRight size={15}/></a></div>
            <img src={heroImages[2]} alt="" />
          </div>
        </div>
      </section>

      <section className="category-strip shell">
        {categories.map(({name, icon: Icon}) => (
          <a key={name} className="category-card" href="#">
            <span><Icon strokeWidth={1.5}/></span>
            <b>{name}</b>
            <small>14 products</small>
          </a>
        ))}
      </section>

      <section className="section shell">
        <div className="section-head">
          <div><h2>Today&apos;s Best Deals</h2><p>Hurry up! Offer ends in:</p></div>
          <div className="countdown"><b>04</b><span>:</span><b>09</b><span>:</span><b>01</b><span>:</span><b>16</b></div>
        </div>
        <div className="product-grid">
          {filtered.map((p, i) => <ProductCard key={i} product={p} onAdd={() => setCart(c => c + 1)} />)}
        </div>
      </section>

      <section className="voucher shell">
        <div>
          <span className="eyebrow">Big Promotion</span>
          <h2>Grab Your Vouchers!</h2>
          <p>Up to 35% Off everything code.<br/>Limited time only. Excludes selected lines.</p>
        </div>
        <button className="coupon" onClick={copyCoupon}><b>CODE6789</b>{copied ? <Check size={18}/> : <Copy size={18}/>}<span>{copied ? "Copied" : "Copy"}</span></button>
        <a className="light-btn" href={demo}>Shop Sale <ArrowRight size={17}/></a>
      </section>

      <section className="split-sections shell">
        <div>
          <div className="section-title-row"><h2>Popular Picks</h2><a>View All <ArrowRight size={15}/></a></div>
          <div className="mini-list">
            {products.slice(0,4).map((p,i) => (
              <div className="mini-product" key={i}>
                <img src={p.image} alt="" />
                <div><b>{p.title}</b><p><del>{p.old}</del> <strong>{p.price}</strong></p></div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="section-title-row"><h2>Best Selling</h2><a>View All <ArrowRight size={15}/></a></div>
          <div className="mini-list">
            {products.slice(3,7).map((p,i) => (
              <div className="mini-product" key={i}>
                <img src={p.image} alt="" />
                <div><b>{p.title}</b><p><del>{p.old}</del> <strong>{p.price}</strong></p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section shell">
        <div className="section-title-row"><h2>Featured Brands</h2><a>View All <ArrowRight size={15}/></a></div>
        <div className="brands">
          {["Apple","Samsung","Xiaomi","Lenovo","Sony","JBL"].map(x => <div key={x}>{x}</div>)}
        </div>
      </section>

      <section className="electronics shell">
        <div className="electronics-copy">
          <span className="eyebrow">Save 30—50% electronics</span>
          <h2>Small Size Big Sound</h2>
          <p>A mini speaker with powerful and dynamic sound. Compact and portable, perfect for any space and easy to carry anywhere.</p>
          <a className="dark-btn" href={demo}>Shop Now <ArrowRight size={17}/></a>
        </div>
        <img src={heroImages[1]} alt="" />
        <div className="electronics-list">
          {products.slice(4,7).map((p,i) => <div className="mini-product" key={i}><img src={p.image} alt=""/><div><b>{p.title}</b><p><del>{p.old}</del> <strong>{p.price}</strong></p></div></div>)}
        </div>
      </section>

      <section className="services shell">
        <div><Truck/><span><b>Free Shipping</b><small>Enjoy free worldwide shipping and returns.</small></span></div>
        <div><RotateCcw/><span><b>Free Returns</b><small>Free returns within 15 days.</small></span></div>
        <div><Headphones/><span><b>Support Online</b><small>We support customers 24/7.</small></span></div>
      </section>

      <footer className="footer">
        <div className="shell footer-grid">
          <div>
            <h3>HELP CENTER</h3>
            <h2>Online Support 24/7</h2>
            <p><b>Call Us</b><br/>Call now +222-1800-2628</p>
            <p><b>Chat with Us</b><br/>Chat now with an expert</p>
            <p><b>Email Us</b><br/>support@example.com</p>
          </div>
          <div><h3>About The Store</h3><p>Find a location nearest you to reduce shipping costs and make shopping easier.</p><p>+1 (973) 435-3638</p><p>support@example.com</p></div>
          <div><h3>Our Company</h3><a>Terms Of Use</a><a>Privacy Policy</a><a>About Us</a><a>Contact Us</a><a>FAQ</a><a>Store Location</a></div>
          <div><h3>Shop Categories</h3><a>Hot Deals</a><a>Best Seller</a><a>Sale & Special Offers</a><a>Macbook/PCs</a><a>Popular Trends</a><a>Tablets/iPad Pro</a></div>
          <div><h3>Newsletter</h3><p>Sign up for 10% off your first purchase and free shipping.</p><div className="newsletter"><input placeholder="Enter your email"/><button><ArrowRight/></button></div></div>
        </div>
        <div className="shell footer-bottom">
          <span>© 2026 Glozin store. Preview recreation.</span>
          <img src={asset + "/03/payment.webp"} alt="Payment methods"/>
        </div>
      </footer>
    </main>
  );
}
