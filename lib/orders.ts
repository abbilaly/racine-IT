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
  variantName?: string | null;
};

export type StoredOrder = CreateOrderResponse & {
  status: string;
  delivery: DeliveryMethod;
  payment: PaymentMethod;
  note: string | null;
  customer: CustomerInput;
  items: StoredOrderItem[];
};

/**
 * Prices are handled as integer cents everywhere on the server. Formatting is
 * delegated to the shared currency formatter, which labels the amount with the
 * store's own currency (MAD on the live store, USD when configured) instead of
 * assuming dollars.
 */
export { formatCents, formatMoney } from "@/lib/currency";

export function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/** Normalises a user-typed order reference such as "rit-ab12cd34". */
export function normaliseRef(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}
