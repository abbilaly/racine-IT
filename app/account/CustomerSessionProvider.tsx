"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";

interface CustomerSession {
  userId: string;
  email: string;
  accessToken?: string;
}

interface AccountState {
  session: CustomerSession | null;
  profile: {
    fullName: string;
    email: string;
    phone: string | null;
    emailConfirmed: boolean;
    createdAt: string | null;
  } | null;
  loading: boolean;
  error: string | null;
}

interface CustomerSessionContextValue extends AccountState {
  refresh: () => Promise<void>;
}

const CustomerSessionContext = createContext<CustomerSessionContextValue | null>(null);

export function useCustomerSession() {
  const ctx = useContext(CustomerSessionContext);
  if (!ctx) {
    throw new Error("useCustomerSession must be used within CustomerSessionProvider");
  }
  return ctx;
}

export default function CustomerSessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AccountState>({
    session: null,
    profile: null,
    loading: true,
    error: null,
  });

  const refresh = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const me = await fetch("/api/auth/me", { cache: "no-store" }).then(r => r.json());
      if (!me?.customer) {
        setState({ session: null, profile: null, loading: false, error: null });
        return;
      }
      setState({
        session: { userId: me.customer.id, email: me.customer.email },
        profile: {
          fullName: me.customer.fullName ?? "",
          email: me.customer.email,
          phone: me.customer.phone ?? null,
          emailConfirmed: me.customer.emailConfirmed ?? false,
          createdAt: me.customer.createdAt ?? null,
        },
        loading: false,
        error: null,
      });
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: "We could not load your account right now." }));
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <CustomerSessionContext.Provider value={{ ...state, refresh }}>
      {children}
    </CustomerSessionContext.Provider>
  );
}
