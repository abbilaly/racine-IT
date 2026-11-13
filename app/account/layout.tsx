import { Metadata } from "next";
import { Settings, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { BRAND } from "@/lib/site-config";
import CustomerSessionProvider from "./CustomerSessionProvider";
import SignOutButton from "./profile/SignOutButton";

export const metadata: Metadata = {
  title: "My Account — AB Tech",
  description: "Signed-in account area for AB Tech customers.",
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <CustomerSessionProvider>
      <div className="account-shell">
        <header className="account-header">
          <div className="site-shell account-header-inner">
            <Link href="/" className="site-wordmark account-wordmark">
              {BRAND}
            </Link>
            <nav className="account-nav" aria-label="Account navigation">
              <Link href="/account/profile" className="account-nav-link" title="View and edit your profile">
                <Settings size={18} strokeWidth={1.7} />
                <span>Profile</span>
              </Link>
              <Link href="/account/orders" className="account-nav-link" title="View your order history">
                <ShoppingBag size={18} strokeWidth={1.7} />
                <span>My Orders</span>
              </Link>
            </nav>
            <SignOutButton />
          </div>
        </header>
        <main className="site-shell page account-main">{children}</main>
      </div>
    </CustomerSessionProvider>
  );
}
