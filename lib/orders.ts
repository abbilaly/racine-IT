export const EXPRESS_FEE = 15;

export const DELIVERY_METHODS = ["standard", "express"] as const;
export const PAYMENT_METHODS = ["card", "paypal", "cod"] as const;

export type DeliveryMethod = (typeof DELIVERY_METHODS)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type OrderItemInput = { slug: string; qty: number };

export type CustomerInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postal: string;
  country: string;
};

export type CreateOrderRequest = {
  items: OrderItemInput[];
  customer: CustomerInput;
  delivery: DeliveryMethod;
  payment: PaymentMethod;
  note?: string;
};

export type CreateOrderResponse = {
  ref: string;
  id: string;
  itemCount: number;
  subtotal: number;
  shipping: number;
  total: number;
  createdAt: string;
};

export type StoredOrderItem = {
  slug: string;
  title: string;
  unitPrice: number;
  qty: number;
  lineTotal: number;
};

export type StoredOrder = CreateOrderResponse & {
  status: string;
  delivery: DeliveryMethod;
  payment: PaymentMethod;
  note: string | null;
  customer: CustomerInput;
  items: StoredOrderItem[];
};

/** Prices are handled as integer cents everywhere on the server. */
export function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/** Normalises a user-typed order reference such as "rit-ab12cd34". */
export function normaliseRef(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}
