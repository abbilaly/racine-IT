import { formatCents, formatMoney } from "@/lib/currency";
import type { OrderTemplateParams } from "./email-templates-types";
import type { QuotationTemplateParams } from "./email-templates-types";

export type { OrderTemplateParams, QuotationTemplateParams } from "./email-templates-types";

export function orderConfirmationTemplate(params: OrderTemplateParams): string {
  const { storeName, ref, customerName, items, shipping, total, customer, currency } = params;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(storeName)} — Order confirmed</title>
</head>
<body style="margin:0;padding:0;background-color:#f6f6f6;font-family:Arial,Helvetica,sans-serif;color:#111111">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f6f6f6">
    <tr>
      <td align="center" style="padding:32px 16px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border:1px solid #e7e7e7;border-radius:8px">
          <tr>
            <td style="padding:24px 28px;border-bottom:1px solid #f0f0f0">
              <h1 style="margin:0 0 8px;font-size:22px">Order confirmed</h1>
              <p style="margin:0;font-size:14px;color:#555555">Thank you for your order, ${escapeHtml(customerName)}.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px">
              <p style="margin:0 0 16px;font-size:14px">Your order <strong>${escapeHtml(ref)}</strong> has been received.</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
                <thead>
                  <tr style="border-bottom:1px solid #e7e7e7">
                    <th width="60%" align="left" style="padding:8px 0;font-size:13px;text-align:left">Item</th>
                    <th width="12%" align="right" style="padding:8px 0;font-size:13px">Qty</th>
                    <th width="14%" align="right" style="padding:8px 0;font-size:13px">Price</th>
                    <th width="14%" align="right" style="padding:8px 0;font-size:13px">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${items
                    .map(
                      (item) => `
                  <tr>
                    <td style="padding:8px 0;font-size:14px">${escapeHtml(item.title)}</td>
                    <td style="padding:8px 0;font-size:14px;text-align:right">${item.qty}</td>
                    <td style="padding:8px 0;font-size:14px;text-align:right">${formatMoney(item.price, currency)}</td>
                    <td style="padding:8px 0;font-size:14px;text-align:right">${formatMoney(item.total, currency)}</td>
                  </tr>
                  `
                    )
                    .join("")}
                </tbody>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border-collapse:collapse">
                <tr>
                  <td style="padding:4px 0;font-size:14px">Subtotal</td>
                  <td style="padding:4px 0;font-size:14px;text-align:right">${formatMoney(items.reduce((sum, i) => sum + i.total, 0), currency)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;font-size:14px">Shipping</td>
                  <td style="padding:4px 0;font-size:14px;text-align:right">${formatCents(shipping, currency)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;font-size:14px">Total</td>
                  <td style="padding:4px 0;font-size:14px;text-align:right">${formatCents(total, currency)}</td>
                </tr>
              </table>
              <p style="margin:16px 0 0;font-size:14px;color:#555555">
                Shipping to: ${escapeHtml(customer.address)}, ${escapeHtml(customer.city)}${customer.postal ? ` ${escapeHtml(customer.postal)}` : ""}
              </p>
              ${customer.phone ? `<p style="margin:4px 0 0;font-size:14px;color:#555555">Phone: ${escapeHtml(customer.phone)}</p>` : ""}
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px">
              <p style="margin:0;font-size:12px;color:#777777">
                If you have any questions, reply to this email or contact us through the storefront.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function quotationTemplate(params: QuotationTemplateParams): string {
  const {
    storeName,
    ref,
    customerName,
    company,
    items,
    subtotal,
    tax,
    total,
    validFrom,
    validUntil,
    notes,
    terms,
    currency,
  } = params;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(storeName)} — Quotation ${escapeHtml(ref)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f6f6f6;font-family:Arial,Helvetica,sans-serif;color:#111111">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f6f6f6">
    <tr>
      <td align="center" style="padding:32px 16px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border:1px solid #e7e7e7;border-radius:8px">
          <tr>
            <td style="padding:24px 28px;border-bottom:1px solid #f0f0f0">
              <h1 style="margin:0 0 8px;font-size:22px">Quotation ${escapeHtml(ref)}</h1>
              <p style="margin:0;font-size:14px;color:#555555">
                ${company ? `<strong>${escapeHtml(customerName)}</strong> — ${escapeHtml(company)}` : escapeHtml(customerName)}
              </p>
              <p style="margin:8px 0 0;font-size:13px;color:#777777">
                ${validFrom ? `Valid from ${escapeHtml(validFrom)}` : ""}
                ${validFrom && validUntil ? " to " : ""}
                ${validUntil ? `Valid until ${escapeHtml(validUntil)}` : ""}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px">
              <p style="margin:0 0 16px;font-size:14px">Thank you for your interest in ${escapeHtml(storeName)}.</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
                <thead>
                  <tr style="border-bottom:1px solid #e7e7e7">
                    <th width="60%" align="left" style="padding:8px 0;font-size:13px;text-align:left">Item</th>
                    <th width="12%" align="right" style="padding:8px 0;font-size:13px">Qty</th>
                    <th width="14%" align="right" style="padding:8px 0;font-size:13px">Unit price</th>
                    <th width="14%" align="right" style="padding:8px 0;font-size:13px">Line total</th>
                  </tr>
                </thead>
                <tbody>
                  ${items
                    .map(
                      (item) => `
                  <tr>
                    <td style="padding:8px 0;font-size:14px">${escapeHtml(item.title)}</td>
                    <td style="padding:8px 0;font-size:14px;text-align:right">${item.qty}</td>
                    <td style="padding:8px 0;font-size:14px;text-align:right">${formatCents(item.price, currency)}</td>
                    <td style="padding:8px 0;font-size:14px;text-align:right">${formatCents(item.total, currency)}</td>
                  </tr>
                  `
                    )
                    .join("")}
                </tbody>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border-collapse:collapse">
                <tr>
                  <td style="padding:4px 0;font-size:14px">Subtotal</td>
                  <td style="padding:4px 0;font-size:14px;text-align:right">${formatCents(subtotal, currency)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;font-size:14px">Tax</td>
                  <td style="padding:4px 0;font-size:14px;text-align:right">${formatCents(tax, currency)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;font-size:14px;font-weight:bold">Total</td>
                  <td style="padding:4px 0;font-size:14px;text-align:right;font-weight:bold">${formatCents(total, currency)}</td>
                </tr>
              </table>
              ${notes ? `<p style="margin:16px 0 0;font-size:13px;color:#555555">${escapeHtml(notes)}</p>` : ""}
              ${terms ? `<p style="margin:12px 0 0;font-size:13px;color:#555555">${escapeHtml(terms)}</p>` : ""}
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px">
              <p style="margin:0;font-size:12px;color:#777777">This quotation is issued by ${escapeHtml(storeName)} and is not a confirmed order.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
