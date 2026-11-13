import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getProduct } from "@/lib/products";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  DELIVERY_METHODS,
  EXPRESS_FEE,
  PAYMENT_METHODS,
  normaliseRef,
  toCents,
  type CreateOrderRequest,
  type CreateOrderResponse,
  type CustomerInput,
  type DeliveryMethod,
  type OrderItemInput,
  type PaymentMethod,
  type StoredOrder,
  type StoredOrderItem
} from "@/lib/orders";

/** Minimal structural view of the D1 API this module uses. */
type D1Statement = {
  bind(...values: unknown[]): D1Statement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
};
type D1Like = {
  prepare(sql: string): D1Statement;
  batch(statements: D1Statement[]): Promise<unknown[]>;
};

/**
 * Whether the customer can safely retry.
 *
 * - `not_created`: the order was rejected before it could be written, so a retry
 *   cannot duplicate anything.
 * - `unknown`: the write may or may not have reached Postgres (timeout, aborted
 *   request, transport failure). Retrying can create a second order, so the
 *   storefront must tell the customer to check for a confirmation first.
 */
export type OrderOutcome = "not_created" | "unknown";

export class OrderError extends Error {
  constructor(message: string, readonly status: number, readonly outcome: OrderOutcome = "not_created") {
    super(message);
    this.name = "OrderError";
  }
}

export function getDb(): D1Like {
  const { env } = getCloudflareContext();
  const db = (env as unknown as { DB?: D1Like }).DB;
  if (!db) {
    throw new OrderError("The order database is not configured for this environment.", 503);
  }
  return db;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    ref TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    postal TEXT NOT NULL,
    country TEXT NOT NULL,
    delivery TEXT NOT NULL,
    payment TEXT NOT NULL,
    note TEXT,
    item_count INTEGER NOT NULL,
    subtotal INTEGER NOT NULL,
    shipping INTEGER NOT NULL,
    total INTEGER NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    unit_price INTEGER NOT NULL,
    qty INTEGER NOT NULL,
    line_total INTEGER NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_orders_ref ON orders(ref)`,
  `CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)`
];

let schemaReady: Promise<void> | null = null;

async function ensureSchema(db: D1Like): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      for (const sql of SCHEMA) {
        await db.prepare(sql).run();
      }
    })().catch(error => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

function text(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== "string") throw new OrderError(`${field} is required.`, 400);
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    throw new OrderError(`${field} must be between ${min} and ${max} characters.`, 400);
  }
  return trimmed;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new OrderError(`${field} is invalid.`, 400);
  }
  return value as T;
}

function parseItems(raw: unknown): OrderItemInput[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new OrderError("Your cart is empty.", 400);
  }
  if (raw.length > 40) throw new OrderError("Too many lines in the cart.", 400);

  const merged = new Map<string, number>();
  for (const entry of raw) {
    const slug = typeof entry?.slug === "string" ? entry.slug.trim() : "";
    const qty = entry?.qty;
    if (!slug) throw new OrderError("A cart line is missing its product.", 400);
    if (typeof qty !== "number" || !Number.isInteger(qty) || qty < 1 || qty > 20) {
      throw new OrderError("Quantity must be a whole number between 1 and 20.", 400);
    }
    merged.set(slug, (merged.get(slug) ?? 0) + qty);
  }
  return [...merged].map(([slug, qty]) => ({ slug, qty }));
}

function parseCustomer(raw: unknown): CustomerInput {
  if (!raw || typeof raw !== "object") throw new OrderError("Delivery details are required.", 400);
  const r = raw as Record<string, unknown>;
  const email = text(r.email, "Email", 5, 120);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new OrderError("Enter a valid email address.", 400);
  }
  const postal = text(r.postal, "Postal code", 3, 10);
  if (!/^[A-Za-z0-9 -]+$/.test(postal)) {
    throw new OrderError("Postal code may only contain letters, digits, spaces and dashes.", 400);
  }
  return {
    firstName: text(r.firstName, "First name", 1, 60),
    lastName: text(r.lastName, "Last name", 1, 60),
    email,
    phone: text(r.phone, "Phone", 5, 40),
    address: text(r.address, "Address", 3, 160),
    city: text(r.city, "City", 1, 80),
    postal,
    country: text(r.country, "Country", 2, 56)
  };
}

export function parseOrderRequest(raw: unknown): CreateOrderRequest {
  if (!raw || typeof raw !== "object") throw new OrderError("Request body must be an object.", 400);
  const body = raw as Record<string, unknown>;
  const items = parseItems(body.items);
  const note = body.note == null ? undefined : text(body.note, "Note", 1, 500);
  return {
    items,
    customer: parseCustomer(body.customer),
    delivery: oneOf<DeliveryMethod>(body.delivery, DELIVERY_METHODS, "Delivery method"),
    payment: oneOf<PaymentMethod>(body.payment, PAYMENT_METHODS, "Payment method"),
    note
  };
}

function makeRef(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `RIT-${out}`;
}

type OrderRow = {
  id: string;
  ref: string;
  status: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postal: string;
  country: string;
  delivery: string;
  payment: string;
  note: string | null;
  item_count: number;
  subtotal: number;
  shipping: number;
  total: number;
  created_at: string;
};

type ItemRow = {
  slug: string;
  title: string;
  unit_price: number;
  qty: number;
  line_total: number;
};

/**
 * Whether a placed order may be attributed to a customer account.
 *
 * Order ownership is written by the optional `p_user_id` parameter of
 * `create_order()`, which only exists after migration 0006. The function
 * deployed today takes five parameters (p_items, p_customer, p_delivery,
 * p_payment, p_note), and PostgREST rejects the entire call when it is sent an
 * unknown argument — so sending `p_user_id` breaks *every* checkout, guest ones
 * included.
 *
 * MVP: ownership stays OFF and every order is a guest order
 * (`orders.user_id = NULL`). Do not claim that customer order ownership works
 * until 0006 is applied, the extended function is verified, and this flag is
 * turned on. No fake user id is ever sent.
 */
export const ORDER_OWNERSHIP_ENABLED: boolean = false;

/**
 * RPC parameters for `create_order()`.
 *
 * The guest path sends exactly the five parameters the deployed function
 * declares. `p_user_id` is added only when order ownership is enabled and a
 * verified customer id exists, so the authenticated shape is ready for 0006
 * without ever sending an unknown argument today.
 */
export function buildCreateOrderRpcParams(request: CreateOrderRequest, customerUserId?: string) {
  return {
    p_items: request.items.map(item => ({ slug: item.slug, qty: item.qty })),
    p_customer: request.customer,
    p_delivery: request.delivery,
    p_payment: request.payment,
    p_note: request.note ?? null,
    ...(ORDER_OWNERSHIP_ENABLED && customerUserId ? { p_user_id: customerUserId } : {})
  };
}

/**
 * Supabase path: re-validate in Postgres through the security-definer
 * create_order() function, which re-prices every line, locks the inventory
 * rows it touches and writes order + items + stock in one transaction.
 *
 * The payload is built so that the guest path sends exactly the five parameters
 * the deployed function declares. `p_user_id` is only added when ownership is
 * enabled (see ORDER_OWNERSHIP_ENABLED), which keeps the authenticated call
 * shape ready for 0006 without breaking today's checkout.
 */
async function createOrderSupabase(request: CreateOrderRequest, customerUserId?: string): Promise<CreateOrderResponse> {
  const supabase = getServiceClient();
  if (!supabase) {
    throw new OrderError("The order database is not configured for this environment.", 503);
  }

  const { data, error } = await supabase.rpc(
    "create_order",
    buildCreateOrderRpcParams(request, customerUserId)
  );

  if (error || !data) {
    if (error?.code === "RC001") {
      const conflict = /left of|no longer available|currently unavailable|temporarily unavailable/i.test(
        error.message
      );
      throw new OrderError(error.message, conflict ? 409 : 400);
    }
    // Safe server-side diagnostic logging for order creation failures.
    // Never log raw credentials, tokens, full customer data, or stack traces.
    let errorCode = "unknown";
    let errorCategory = "unknown";
    if (error instanceof Object && "code" in error) {
      errorCode = String((error as { code: unknown }).code ?? "unknown");
    }
    if (error instanceof Object && "message" in error) {
      const message = String((error as { message: unknown }).message ?? "");
      if (/RC001/i.test(errorCode) || /left.of|no.longer.available|currently.unavailable|temporarily.unavailable/i.test(message)) {
        errorCategory = "business_rule_violation";
      } else if (/duplicate|already.exists/i.test(message)) {
        errorCategory = "duplicate";
      } else if (/rate.limit|too.many|flood/i.test(message)) {
        errorCategory = "rate_limited";
      } else if (/unauthorized|invalid|credential|permission|forbidden/i.test(message)) {
        errorCategory = "permission_or_auth";
      } else if (/network|fetch|timeout|econnrefused|econnreset/i.test(message)) {
        errorCategory = "network";
      } else if (/not.found|does.not.exist/i.test(message)) {
        errorCategory = "not_found";
      } else {
        errorCategory = "other";
      }
    }
    console.error(
      `[createOrderSupabase] failure: errorCode=${errorCode} errorCategory=${errorCategory} ` +
      `customerEmail=${request.customer.email.length > 0 ? request.customer.email.slice(0, 4) + "***@***" : "(no email)"} ` +
      `productSlugs=${request.items.map(i => i.slug).join(",")}`
    );
    // A transport failure means the RPC may still have committed: the order can
    // exist even though this response is an error. Retrying must not be
    // presented as safe, or the customer can create a second order.
    const ambiguous = !error || errorCategory === "network" || errorCategory === "other" || errorCategory === "unknown";
    throw new OrderError(
      ambiguous
        ? "We could not confirm whether your order was saved. Check your email for a confirmation before ordering again."
        : "We could not save your order. Please try again.",
      503,
      ambiguous ? "unknown" : "not_created"
    );
  }

  const result = data as {
    ref: string;
    id: string;
    item_count: number;
    subtotal: number;
    shipping: number;
    total: number;
    created_at: string;
  };

  return {
    ref: result.ref,
    id: result.id,
    itemCount: result.item_count,
    subtotal: result.subtotal,
    shipping: result.shipping,
    total: result.total,
    createdAt: result.created_at,
  };
}

const STATUS_LABELS: Record<string, string> = {
  received: "Received",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
const DELIVERY_LABELS: Record<string, string> = {
  standard: "Standard delivery",
  express: "Express delivery",
};
const PAYMENT_LABELS: Record<string, string> = {
  card: "Card payment",
  paypal: "PayPal",
  cod: "Cash on delivery",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function deliveryLabel(delivery: string): string {
  return DELIVERY_LABELS[delivery] ?? delivery;
}

export function paymentLabel(payment: string): string {
  return PAYMENT_LABELS[payment] ?? payment;
}

export { createOrderSupabase };

/**
 * Validates the request, then writes it through Supabase (or the legacy D1
 * store when Supabase is not configured). Client prices are never trusted:
 * both paths price every line from the server-side catalogue.
 */
export async function createOrder(raw: unknown): Promise<CreateOrderResponse> {
  const request = parseOrderRequest(raw);
  if (isSupabaseConfigured()) return createOrderSupabase(request);
  return createOrderWithD1(request);
}

async function createOrderWithD1(request: CreateOrderRequest): Promise<CreateOrderResponse> {
  const db = getDb();
  await ensureSchema(db);

  const lines = request.items.map(item => {
    const product = getProduct(item.slug);
    if (!product) throw new OrderError("One of the products in your cart is no longer available.", 400);
    if (item.qty > product.stock) {
      throw new OrderError(
        `Only ${product.stock} left of “${product.title}”. Adjust the quantity and try again.`,
        409
      );
    }
    const unitPrice = toCents(product.price);
    return {
      slug: product.slug,
      title: product.title,
      unitPrice,
      qty: item.qty,
      lineTotal: unitPrice * item.qty
    };
  });

  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const shipping = request.delivery === "express" ? toCents(EXPRESS_FEE) : 0;
  const total = subtotal + shipping;
  const itemCount = lines.reduce((sum, line) => sum + line.qty, 0);
  const id = crypto.randomUUID();
  const ref = makeRef();
  const createdAt = new Date().toISOString();
  const c = request.customer;

  const orderStatement = db
    .prepare(
      `INSERT INTO orders (id, ref, status, first_name, last_name, email, phone, address, city, postal, country, delivery, payment, note, item_count, subtotal, shipping, total, created_at)
       VALUES (?, ?, 'received', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      ref,
      c.firstName,
      c.lastName,
      c.email,
      c.phone,
      c.address,
      c.city,
      c.postal,
      c.country,
      request.delivery,
      request.payment,
      request.note ?? null,
      itemCount,
      subtotal,
      shipping,
      total,
      createdAt
    );

  const itemStatements = lines.map(line =>
    db
      .prepare(
        `INSERT INTO order_items (order_id, slug, title, unit_price, qty, line_total)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(id, line.slug, line.title, line.unitPrice, line.qty, line.lineTotal)
  );

  await db.batch([orderStatement, ...itemStatements]);

  return { ref, id, itemCount, subtotal, shipping, total, createdAt };
}

async function getOrderFromSupabase(ref: string): Promise<StoredOrder | null> {
  const supabase = getServiceClient();
  if (!supabase) {
    throw new OrderError("The order database is not configured for this environment.", 503);
  }

  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("ref", ref)
    .maybeSingle();

  if (error) {
    console.error("Supabase order lookup failed", error);
    throw new OrderError("We could not load that order right now.", 503);
  }
  if (!data) return null;

  const rows = (data.order_items ?? []) as {
    slug: string;
    title: string;
    unit_price: number;
    qty: number;
    line_total: number;
  }[];

  return {
    id: data.id,
    ref: data.ref,
    status: data.status,
    itemCount: data.item_count,
    subtotal: data.subtotal,
    shipping: data.shipping,
    total: data.total,
    createdAt: data.created_at,
    delivery: data.delivery,
    payment: data.payment,
    note: data.note ?? null,
    customer: {
      firstName: data.first_name,
      lastName: data.last_name,
      email: data.email,
      phone: data.phone,
      address: data.address,
      city: data.city,
      postal: data.postal,
      country: data.country
    },
    items: rows.map(row => ({
      slug: row.slug,
      title: row.title,
      unitPrice: row.unit_price,
      qty: row.qty,
      lineTotal: row.line_total
    }))
  };
}

export async function getOrder(rawRef: string): Promise<StoredOrder | null> {
  const ref = normaliseRef(rawRef);
  if (!/^RIT-[A-Z0-9]{8}$/.test(ref)) return null;
  if (isSupabaseConfigured()) return getOrderFromSupabase(ref);
  return getOrderFromD1(ref);
}

async function getOrderFromD1(ref: string): Promise<StoredOrder | null> {
  const db = getDb();
  await ensureSchema(db);

  const order = await db.prepare(`SELECT * FROM orders WHERE ref = ?`).bind(ref).first<OrderRow>();
  if (!order) return null;

  const itemRows = await db
    .prepare(`SELECT slug, title, unit_price, qty, line_total FROM order_items WHERE order_id = ? ORDER BY id`)
    .bind(order.id)
    .all<ItemRow>();
  const rows = itemRows ? itemRows.results : [];

  const items: StoredOrderItem[] = rows.map(row => ({
    slug: row.slug,
    title: row.title,
    unitPrice: row.unit_price,
    qty: row.qty,
    lineTotal: row.line_total
  }));

  return {
    id: order.id,
    ref: order.ref,
    status: order.status,
    itemCount: order.item_count,
    subtotal: order.subtotal,
    shipping: order.shipping,
    total: order.total,
    createdAt: order.created_at,
    delivery: order.delivery as DeliveryMethod,
    payment: order.payment as PaymentMethod,
    note: order.note,
    customer: {
      firstName: order.first_name,
      lastName: order.last_name,
      email: order.email,
      phone: order.phone,
      address: order.address,
      city: order.city,
      postal: order.postal,
      country: order.country
    },
    items
  };
}
