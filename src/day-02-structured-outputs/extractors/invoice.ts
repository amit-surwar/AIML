/**
 * ============================================================================
 *  STAGE 8  —  EXTRACTOR: Invoice / Receipt
 *  src/day-02-structured-outputs/extractors/invoice.ts
 * ============================================================================
 *
 *  ROLE
 *    Convert raw invoice text (from OCR, email, PDF-to-text, screenshot,
 *    photo of a paper receipt, etc.) into a normalized structured record.
 *
 *  REAL-WORLD ANALOG
 *    Stripe Tax, Ramp, Brex, Mercury, Razorpay's expense tools all parse
 *    invoices with patterns very similar to this. Two years ago this
 *    required a custom-trained OCR + NER pipeline. Today: one Zod schema.
 *
 *  AI/ML SKILLS THIS DEMONSTRATES
 *    1. NORMALIZATION at the schema layer:
 *         - "18 April 2026" / "04/18/26" / "Apr 18, 2026"  →  "2026-04-18"
 *         - "Rs", "₹", "Rupees", "INR"                     →  "INR"
 *       The model does the messy parsing; the schema enforces consistency.
 *    2. NESTED SCHEMAS — invoices have line items, which are themselves
 *       structured. Zod composes naturally (z.array(z.object(...))).
 *    3. .nullable() vs missing — for fields that may legitimately be
 *       absent (e.g. due_date isn't always written), allowing null beats
 *       letting the model invent a value. "Never invent" goes in the
 *       system prompt to enforce this.
 *    4. NUMERIC coercion — z.number().nonnegative() forces the model to
 *       return real numbers, not strings like "3,240.00". Downstream
 *       code can do arithmetic without parsing.
 * ============================================================================
 */

import { z } from "zod";
import type { ExtractorDefinition } from "@/day-02-structured-outputs/lib/extract";

/*
 * Nested schema — line items inside an invoice. Defined separately so
 * we can reuse the type for individual line-item validation if needed
 * (e.g. when an editor lets a user manually add/remove a line later).
 */
const lineItemSchema = z.object({
  description: z.string().min(1).max(200),
  quantity: z.number().nonnegative(),
  unit_price: z.number().nonnegative(),
  total: z.number().nonnegative().describe("quantity * unit_price"),
});

const invoiceSchema = z.object({
  invoice_number: z.string().min(1).describe("As shown on the document."),
  vendor_name: z.string().min(1),
  vendor_address: z.string().nullable(),
  customer_name: z.string().nullable(),

  /*
   * Date normalization. The model will see dates in many formats; the
   * description tells it to emit ONE canonical format. This is far more
   * reliable than parsing the model's output with date-fns afterwards.
   * Note: we use z.string() not z.date() because the SDK serializes
   * objects as JSON, and JSON has no native Date type.
   */
  issue_date: z
    .string()
    .describe("ISO 8601 date (YYYY-MM-DD). Normalize any format to this."),

  due_date: z
    .string()
    .nullable()
    .describe("ISO 8601 date (YYYY-MM-DD), or null if not present."),

  /*
   * Currency normalization. Whether the doc says "Rs", "₹", "Rupees",
   * "INR", or "Indian Rupees", the model converts to "INR". This is
   * how downstream FX systems can apply rates without per-format hacks.
   */
  currency: z
    .string()
    .length(3)
    .describe("ISO 4217 currency code, e.g. USD, INR, EUR. Infer if not explicit."),

  /*
   * Composing schemas: an array of line items, each fully typed.
   * Notice we allow length 0 — some invoices are just a flat total.
   */
  line_items: z.array(lineItemSchema).min(0),

  subtotal: z.number().nonnegative(),
  tax: z.number().nonnegative().describe("Total tax amount; 0 if none."),
  total: z.number().nonnegative().describe("Grand total to be paid."),

  notes: z.string().nullable(),
});

/*
 * Inferred type — usable anywhere in the codebase. If you later add
 * a "review invoice" UI, it can import { Invoice } and have full
 * type safety. This is the value of co-locating schema and type.
 */
export type Invoice = z.infer<typeof invoiceSchema>;

export const invoiceExtractor: ExtractorDefinition<typeof invoiceSchema> = {
  name: "invoice",
  description: "Extract a structured invoice from messy receipt or invoice text.",
  schema: invoiceSchema,

  /*
   * System prompt = the rules of the operator role.
   * "Never invent values" is the single most important line in this
   * system prompt. Without it, models will fabricate plausible-looking
   * due dates, GSTINs, addresses. With it + .nullable() on the schema,
   * the model gracefully returns null when data is missing.
   */
  systemPrompt: `You are an invoice parsing system used in production finance pipelines.
- Always normalize dates to ISO 8601 (YYYY-MM-DD).
- Always normalize currency to a 3-letter ISO 4217 code (USD, INR, EUR, GBP, etc.).
- Numbers must be parsed as numbers, not strings.
- If a field is missing from the document, use null where allowed. Never invent values.`,

  buildPrompt: (input): string =>
    `Parse the following invoice text into the schema.

--- INVOICE TEXT ---
${input}
--- END ---`,

  /*
   * Realistic Indian invoice — mixes Indian formatting conventions
   * ("Rs", "GST 18%", "NEFT", "Plot 42"). Good way to test that the
   * model normalizes locally-formatted data to global standards (INR,
   * ISO dates) without losing information.
   */
  sampleInput: `ACME CLOUD SERVICES PVT LTD
Plot 42, HITEC City, Hyderabad, Telangana - 500081
GSTIN: 36AAACA1234A1Z5

INVOICE #INV-2026-0418
Issued: 18 April 2026
Due: 18 May 2026

Bill To:
Zazz Software Pvt Ltd
Plot 12, Banjara Hills, Hyderabad

Items:
- Compute (medium) x 720 hrs @ Rs 4.50/hr = Rs 3,240.00
- Storage x 150 GB-mo @ Rs 8.00 = Rs 1,200.00
- Data Transfer x 95 GB @ Rs 6.00 = Rs 570.00

Subtotal: Rs 5,010.00
GST (18%): Rs 901.80
Total Due: Rs 5,911.80

Pay via UPI or NEFT within 30 days. Late fee 1.5%/month.`,
};
