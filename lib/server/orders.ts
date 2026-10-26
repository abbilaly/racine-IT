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

export class OrderError extends Error {
  constructor(message: string, readonly status: number) {
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
 * Supabase path: re-validate in Postgres through the security-definer
 * create_order() function, which re-prices every line, locks the inventory
 * rows it touches and writes order + items + stock in one transaction.
 */
async function createOrderSupabase(request: CreateOrderRequest): Promise<CreateOrderResponse> {
  const supabase = getServiceClient();
  if (!supabase) {
    throw new OrderError("The order database is not configured for this environment.", 503);
  }

  const items = request.items.map(item => ({ slug: item.slug, qty: item.qty }));
  const { data, error } = await supabase.rpc("create_order", {
    p_items: items,
    p_customer: request.customer,
    p_delivery: request.delivery,
    p_payment: request.payment,
    p_note: request.note ?? null
  });

  if (error || !data) {
    if (error?.code === "RC001") {
      const conflict = /left of|no longer available|currently unavailable|temporarily unavailable/i.test(
        error.message
      );
      throw new OrderError(error.message, conflict ? 409 : 400);
    }
    console.error("Supabase create_order failed", error);
    throw new OrderError("We could not save your order. Please try again.", 503);
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
    createdAt: result.created_at
  };
}

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
