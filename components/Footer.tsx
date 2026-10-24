import Link from "next/link";
import { PAYMENTS } from "@/lib/products";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="site-shell footer-grid">
        <div className="support-column">
          <span>HELP CENTER</span>
          <h2>Online Suport 24/7</h2>
          <p><b>Call Us</b><br />Call now +222-1800-2628</p>
          <p><b>Chat with Us</b><br />Chat now with an expert</p>
          <p><b>Email Us</b><br />support@example.com</p>
        </div>
        <div>
          <h3>About The Store</h3>
          <p>Trusted by 5.9 Million American**. We always try to bring the best experience to customers when shopping at Glozin.</p>
          <p>+1 (973) 435-3638</p>
          <p>support@example.com</p>
        </div>
        <div>
          <h3>Our Company</h3>
          <a>Terms Of Use</a><a>Privacy Policy</a><a>About Us</a><a>Contact Us</a><a>FAQ</a><a>Store Location</a>
        </div>
        <div>
          <h3>Shop Categories</h3>
          <Link href="/shop?sort=discount">Hot Deals</Link>
          <Link href="/shop?sort=rating">Best Seller</Link>
          <Link href="/shop?sort=discount">Sale &amp; Special Offers</Link>
          <Link href="/shop?category=laptops">Macbook/PCs</Link>
          <Link href="/shop?category=phones">Phones/Mobile</Link>
          <Link href="/shop?category=tablets">Tablets/Ipad Pro</Link>
        </div>
        <div>
          <h3>Sign Up to Newsletter</h3>
          <p>Sign up for 10% off your first purchase and free shipping. Updates information on Sales and Offers.</p>
          <label><input placeholder="Enter your email address" /><button>Subscribe</button></label>
        </div>
      </div>
      <div className="site-shell footer-bottom">
        <span>© 2026 Glozin. All Rights Reserved.</span>
        <img src={PAYMENTS} alt="Payment methods" />
      </div>
    </footer>
  );
}
