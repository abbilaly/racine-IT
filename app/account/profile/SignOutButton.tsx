"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { useCustomerSession } from "../CustomerSessionProvider";
import { useRouter } from "next/navigation";

export default function SignOutButton() {
  const router = useRouter();
  const { refresh } = useCustomerSession();
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await fetch("/api/auth/signout", { method: "POST" });
      await refresh();
      router.push("/account");
      router.refresh();
    } catch {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      className="account-sign-out-btn"
      onClick={handleSignOut}
      disabled={loading}
      aria-label="Sign out"
    >
      <LogOut size={18} strokeWidth={1.7} />
      <span>{loading ? "Signing out…" : "Sign out"}</span>
    </button>
  );
}
