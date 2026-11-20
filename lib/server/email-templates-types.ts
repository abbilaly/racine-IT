export type OrderTemplateParams = {
  storeName: string;
  /** ISO currency code the amounts are denominated in (defaults to USD). */
  currency?: string;
  ref: string;
  customerName: string;
  items: Array<{
    title: string;
    qty: number;
    price: number;
    total: number;
  }>;
  shipping: number;
  total: number;
  customer: {
    name: string;
    email: string;
    phone?: string;
    address: string;
    city: string;
    postal?: string;
  };
};

export type QuotationTemplateParams = {
  storeName: string;
  /** ISO currency code the amounts are denominated in (defaults to USD). */
  currency?: string;
  ref: string;
  customerName: string;
  company?: string;
  items: Array<{
    title: string;
    qty: number;
    price: number;
    total: number;
  }>;
  subtotal: number;
  tax: number;
  total: number;
  validFrom?: string;
  validUntil?: string;
  notes?: string;
  terms?: string;
};
