const BASE = process.env.BASE ?? "http://127.0.0.1:8787";
const problems = [];

const baseCustomer = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  phone: "+1 555 0100",
  address: "12 Analytical Way",
  city: "New York",
  postal: "10001",
  country: "United States"
};

async function post(payload) {
  const res = await fetch(`${BASE}/api/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

function expect(condition, message) {
  if (!condition) problems.push(message);
}

// 1. valid express order: 2 x $175 + 1 x $150 = $500 + $15 express = $515
const express = await post({
  items: [
    { slug: "apple-iphone-13-mini-128gb-pink", qty: 2, price: 1 },
    { slug: "apple-airpods-3-2022", qty: 1 }
  ],
  customer: baseCustomer,
  delivery: "express",
  payment: "card"
});
expect(express.status === 201, `express order status ${express.status} (${JSON.stringify(express.body)})`);
expect(/^RIT-[A-Z0-9]{8}$/.test(express.body.ref ?? ""), `bad ref: ${express.body.ref}`);
expect(express.body.subtotal === 50000, `subtotal ${express.body.subtotal}, expected 50000 (client price must be ignored)`);
expect(express.body.shipping === 1500, `shipping ${express.body.shipping}, expected 1500`);
expect(express.body.total === 51500, `total ${express.body.total}, expected 51500`);
expect(express.body.itemCount === 3, `itemCount ${express.body.itemCount}, expected 3`);
console.log("express order ->", express.status, express.body.ref, express.body.total);

// 2. confirmation page renders the persisted record
if (express.body.ref) {
  const page = await fetch(`${BASE}/order/${express.body.ref}`);
  const html = (await page.text()).replace(/<!--[\s\S]*?-->/g, "");
  expect(page.status === 200, `confirmation page status ${page.status}`);
  expect(html.includes(express.body.ref), "confirmation page missing the order reference");
  expect(html.includes("Ada Lovelace"), "confirmation page missing the customer name");
  expect(html.includes("$515.00"), "confirmation page missing the total");
  expect(html.includes("12 Analytical Way"), "confirmation page missing the address");
  expect(html.includes("18 Analytical") === false, "unexpected content");
  console.log("confirmation page ->", page.status, html.includes(express.body.ref) ? "contains ref" : "missing ref");
}

// 3. second order (standard delivery, no express fee) persists alongside the first
const standard = await post({
  items: [{ slug: "portable-wireless-speakers-2025", qty: 2 }],
  customer: { ...baseCustomer, firstName: "Grace", lastName: "Hopper", email: "grace@example.com" },
  delivery: "standard",
  payment: "cod",
  note: "Please leave with the concierge"
});
expect(standard.status === 201, `standard order status ${standard.status}`);
expect(standard.body.shipping === 0, `standard shipping ${standard.body.shipping}, expected 0`);
expect(standard.body.total === 27000, `standard total ${standard.body.total}, expected 27000`);
console.log("standard order ->", standard.status, standard.body.ref, standard.body.total);

if (standard.body.ref) {
  const first = await fetch(`${BASE}/order/${express.body.ref}`);
  expect(first.status === 200, "earlier order page no longer resolves after a second write");
  const page = await fetch(`${BASE}/order/${standard.body.ref}`);
  const html = (await page.text()).replace(/<!--[\s\S]*?-->/g, "");
  expect(html.includes("Grace Hopper"), "second order page missing its customer");
  expect(html.includes("Please leave with the concierge"), "second order page missing the note");
  console.log("second confirmation page ->", page.status);
}

// 4. validation failures
const missingEmail = await post({ items: [{ slug: "apple-airpods-3-2022", qty: 1 }], customer: { ...baseCustomer, email: "" }, delivery: "standard", payment: "cod" });
expect(missingEmail.status === 400, `missing email -> ${missingEmail.status}`);
expect(typeof missingEmail.body.error === "string", "missing email should return an error message");

const emptyCart = await post({ items: [], customer: baseCustomer, delivery: "standard", payment: "cod" });
expect(emptyCart.status === 400, `empty cart -> ${emptyCart.status}`);

const badDelivery = await post({ items: [{ slug: "apple-airpods-3-2022", qty: 1 }], customer: baseCustomer, delivery: "drone", payment: "cod" });
expect(badDelivery.status === 400, `bad delivery -> ${badDelivery.status}`);

const badEmail = await post({ items: [{ slug: "apple-airpods-3-2022", qty: 1 }], customer: { ...baseCustomer, email: "not-an-email" }, delivery: "standard", payment: "cod" });
expect(badEmail.status === 400, `malformed email -> ${badEmail.status}`);

console.log(
  "validation ->",
  `missing email ${missingEmail.status},`,
  `empty cart ${emptyCart.status},`,
  `bad delivery ${badDelivery.status},`,
  `bad email ${badEmail.status}`
);

// 5. stock guard: macbook m2 lists 3 in stock
const overStock = await post({ items: [{ slug: "macbook-pro-16-m2-gray", qty: 5 }], customer: baseCustomer, delivery: "standard", payment: "paypal" });
expect(overStock.status === 409, `over stock -> ${overStock.status}, expected 409`);
console.log("over stock ->", overStock.status, JSON.stringify(overStock.body.error ?? ""));

// 6. unknown product
const unknown = await post({ items: [{ slug: "does-not-exist", qty: 1 }], customer: baseCustomer, delivery: "standard", payment: "cod" });
expect(unknown.status === 400, `unknown product -> ${unknown.status}`);
console.log("unknown product ->", unknown.status);

// 7. malformed body
const res = await fetch(`${BASE}/api/orders`, { method: "POST", headers: { "content-type": "application/json" }, body: "not json" });
expect(res.status === 400, `non-json body -> ${res.status}`);
console.log("non-json body ->", res.status);

// 8. unknown order reference renders 404
const missing = await fetch(`${BASE}/order/RIT-ZZZZZZZZ`);
expect(missing.status === 404, `unknown ref page -> ${missing.status}, expected 404`);
console.log("unknown ref page ->", missing.status);

if (problems.length) {
  console.log("PROBLEMS:");
  for (const p of problems) console.log(" - " + p);
  process.exitCode = 1;
} else {
  console.log("ALL ORDER CHECKS PASSED");
}
