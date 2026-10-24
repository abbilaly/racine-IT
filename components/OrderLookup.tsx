"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { normaliseRef } from "@/lib/orders";

export default function OrderLookup() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ref = normaliseRef(value);
    if (!/^RIT-[A-Z0-9]{8}$/.test(ref)) {
      setError("Enter a reference like RIT-AB12CD34.");
      return;
    }
    setError(null);
    router.push(`/order/${ref}`);
  };

  return (
    <form className="order-lookup" onSubmit={submit}>
      <label>
        Order reference
        <input
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="RIT-AB12CD34"
          aria-describedby={error ? "order-lookup-error" : undefined}
        />
      </label>
      <button type="submit" className="btn-dark">
        <Search size={14} /> Find order
      </button>
      {error && (
        <p className="checkout-error" id="order-lookup-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
