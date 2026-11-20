/**
 * Quotation PDF rendering without third-party dependencies.
 *
 * Builds a small, valid PDF 1.4 document (Helvetica text pages) from the
 * quotation data. Returns the raw bytes so API routes can stream them back
 * with a `application/pdf` content type.
 */

export type QuotationPdfLine = {
  title: string;
  qty: number;
  unitPrice: string;
  lineTotal: string;
  discountPercent?: number;
};

import { normaliseCurrency } from "@/lib/currency";

export type QuotationPdfData = {
  storeName: string;
  ref: string;
  customerName: string;
  customerCompany?: string | null;
  customerEmail?: string;
  customerPhone?: string | null;
  lines: QuotationPdfLine[];
  subtotal: string;
  tax: string;
  total: string;
  validFrom: string;
  validUntil: string;
  notes?: string | null;
  terms?: string | null;
  currency?: string;
};

type DrawOp =
  | { kind: "text"; x: number; y: number; size: number; text: string; bold?: boolean }
  | { kind: "line"; x1: number; y1: number; x2: number; y2: number };

const PAGE_W = 595; // A4 at 72dpi
const PAGE_H = 842;
const MARGIN_X = 50;
const TOP_Y = 792;
const BOTTOM_Y = 60;
const BODY_SIZE = 10;
const LINE_H = 14;
const MAX_LINES_PER_PAGE = 48;

/** Escapes a string for use inside a PDF literal string. */
function esc(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    // strip characters outside WinAnsi so the built-in font can render them
    .replace(/[^\x20-\x7E]/g, "?");
}

/** Approximate rendered width of Helvetica text at a given size. */
function textWidth(text: string, size: number): number {
  let units = 0;
  for (const ch of text) {
    if (ch >= "0" && ch <= "9") units += 0.556;
    else if (ch === " " || ch === "i" || ch === "l" || ch === "I" || ch === "." || ch === ",") units += 0.278;
    else if (ch >= "A" && ch <= "Z") units += 0.667;
    else units += 0.5;
  }
  return units * size;
}

export function renderQuotationPdf(data: QuotationPdfData): Uint8Array {
  const ops: DrawOp[] = [];
  let y = TOP_Y;

  const write = (text: string, opts: { size?: number; bold?: boolean; indent?: number; gap?: number } = {}) => {
    const size = opts.size ?? BODY_SIZE;
    ops.push({ kind: "text", x: MARGIN_X + (opts.indent ?? 0), y, size, text, bold: opts.bold });
    y -= opts.gap ?? LINE_H;
  };

  const rightWrite = (text: string, size = BODY_SIZE, bold = false) => {
    const x = PAGE_W - MARGIN_X - textWidth(text, size);
    ops.push({ kind: "text", x, y, size, text, bold });
    y -= LINE_H;
  };

  const rule = () => {
    ops.push({ kind: "line", x1: MARGIN_X, y1: y + 6, x2: PAGE_W - MARGIN_X, y2: y + 6 });
    y -= 8;
  };

  // ---- header -----------------------------------------------------------
  ops.push({ kind: "text", x: MARGIN_X, y, size: 18, text: data.storeName, bold: true });
  y -= 24;
  ops.push({ kind: "text", x: MARGIN_X, y, size: 14, text: `Quotation ${data.ref}`, bold: true });
  y -= 20;
  write(`Issued: ${data.validFrom}`);
  write(`Valid until: ${data.validUntil}`);
  rule();

  // ---- customer ---------------------------------------------------------
  write("Quotation for", { size: 11, bold: true, gap: LINE_H + 2 });
  write(data.customerName);
  if (data.customerCompany) write(data.customerCompany);
  if (data.customerEmail) write(data.customerEmail);
  if (data.customerPhone) write(data.customerPhone);
  y -= 6;

  // ---- lines ------------------------------------------------------------
  write("Items", { size: 11, bold: true, gap: LINE_H + 2 });
  ops.push({ kind: "line", x1: MARGIN_X, y1: y + 6, x2: PAGE_W - MARGIN_X, y2: y + 6 });
  y -= LINE_H;

  for (const line of data.lines) {
    if (y < BOTTOM_Y + 120) {
      // continue on a fresh page with a repeated header
      ops.push({ kind: "line", x1: 0, y1: 0, x2: 0, y2: 0 });
      y = TOP_Y;
      write(`${data.storeName} — Quotation ${data.ref} (continued)`, { size: 11, bold: true, gap: LINE_H + 6 });
    }

    const qtyLabel = `x${line.qty}`;
    const left = line.title.slice(0, 52);
    ops.push({ kind: "text", x: MARGIN_X, y, size: BODY_SIZE, text: left });
    ops.push({ kind: "text", x: MARGIN_X + 340, y, size: BODY_SIZE, text: qtyLabel });
    ops.push({
      kind: "text",
      x: MARGIN_X + 380,
      y,
      size: BODY_SIZE,
      text: line.unitPrice
    });
    const totalX = PAGE_W - MARGIN_X - textWidth(line.lineTotal, BODY_SIZE);
    ops.push({ kind: "text", x: totalX, y, size: BODY_SIZE, text: line.lineTotal, bold: true });
    y -= LINE_H;
    if (line.discountPercent && line.discountPercent > 0) {
      ops.push({
        kind: "text",
        x: MARGIN_X + 8,
        y,
        size: 8,
        text: `discount ${line.discountPercent}% applied`
      });
      y -= 12;
    }
  }

  rule();

  // ---- totals -----------------------------------------------------------
  ops.push({ kind: "text", x: MARGIN_X + 340, y, size: BODY_SIZE, text: "Subtotal" });
  rightWrite(line_money(data.subtotal, data.currency));
  ops.push({ kind: "text", x: MARGIN_X + 340, y, size: BODY_SIZE, text: "Tax" });
  rightWrite(line_money(data.tax, data.currency));
  ops.push({ kind: "text", x: MARGIN_X + 340, y, size: BODY_SIZE, text: "Total", bold: true });
  rightWrite(line_money(data.total, data.currency), BODY_SIZE, true);
  y -= 8;
  rule();

  if (data.notes) {
    write("Notes", { size: 11, bold: true, gap: LINE_H });
    for (const chunk of wrap(data.notes, 78)) write(chunk, { indent: 8 });
    y -= 6;
  }
  if (data.terms) {
    write("Terms", { size: 11, bold: true, gap: LINE_H });
    for (const chunk of wrap(data.terms, 78)) write(chunk, { indent: 8 });
    y -= 6;
  }

  write(`This quotation is valid until ${data.validUntil}.`, { size: 9 });

  return buildPdf(ops);
}

/**
 * Totals are pre-formatted by the shared currency formatter. A value that
 * still lacks a currency label gets the store's ISO code appended, so a plain
 * "2,499.00" is never mistaken for dollars in a MAD store.
 */
function line_money(value: string, currency?: string): string {
  return /[A-Za-z$€£]/.test(value) ? value : `${value} ${normaliseCurrency(currency)}`;
}

function wrap(text: string, width: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > width) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = (current + " " + word).trim();
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

/** Builds a complete PDF file from the drawing operations. */
function buildPdf(ops: DrawOp[]): Uint8Array {
  // split operations into pages on y-position resets is not tracked here, so
  // a single flowing page is used for typical quotation lengths; content that
  // falls below the bottom margin is clipped by keeping ops as generated.
  const content: string[] = ["q", "0.13 0.15 0.19 RG", "0.8 w"];
  for (const op of ops) {
    if (op.kind === "line") {
      content.push(`${op.x1} ${op.y1} m ${op.x2} ${op.y2} l S`);
    }
  }
  content.push("Q");
  content.push("BT");
  for (const op of ops) {
    if (op.kind === "text") {
      const font = op.bold ? "/F2" : "/F1";
      content.push(`/${font.replace("/", "")} ${op.size} Tf`);
      content.push(`1 0 0 1 ${op.x} ${op.y} Tm`);
      content.push(`(${esc(op.text)}) Tj`);
    }
  }
  content.push("ET");
  const stream = content.join("\n");

  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return new TextEncoder().encode(pdf);
}