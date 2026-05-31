import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import Groq from "groq-sdk";
import { groupShopifyRows } from "@/lib/utils/shopifyCsvGrouper";

// ────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────

interface SkipRowWhere {
  columnIndex: number;
  valueMatchesAny: string[];
}

interface ColumnMap {
  date: number | null;
  description: number | null;
  amount: number | null;
  debit: number | null;
  credit: number | null;
  direction: number | null;
  category: number | null;
  paymentMethod: number | null;
}

interface DescriptionCategoryRule {
  keywords: string[];
  category: string;
}

interface SheetRuleset {
  orientation: "vertical" | "horizontal";
  dataStartRow: number;
  dataEndRow: number | "last";
  skipRowWhere: SkipRowWhere | null;
  skipEmptyAmounts: boolean;
  amountMode: "single" | "debit_credit";
  columns: ColumnMap;
  directionMap: Record<string, string>;
  directionFromSign: boolean;
  categoryMap: Record<string, string>;
  descriptionToCategoryRules: DescriptionCategoryRule[];
  defaultPaymentMethod: "CASH" | "CARD" | "INSTAPAY" | "COD";
}

// ────────────────────────────────────────────────────────────────────
// Valid categories enum
// ────────────────────────────────────────────────────────────────────

const VALID_CATEGORIES = [
  "Sales Revenue",
  "Pop-up/Bazaar Sales",
  "Wholesale/B2B",
  "Supplier Refund",
  "Raw Materials",
  "Packaging",
  "Logistics (Shipping)",
  "Ads",
  "Content Creation",
  "Other",
];

const VALID_PAYMENT_METHODS = ["CASH", "CARD", "INSTAPAY", "COD"];

// ────────────────────────────────────────────────────────────────────
// Pass 1 — Build sheet fingerprint & call Groq for structure detection
// ────────────────────────────────────────────────────────────────────

function buildFingerprint(
  headers: string[],
  rows: Record<string, any>[]
): { headers: string[]; sample: Record<string, any>[] } {
  // Convert rows to arrays of values for index-based access later, but
  // for the fingerprint we keep the key-value format the AI can read.

  const first8 = rows.slice(0, 8);
  const last3 = rows.length > 8 ? rows.slice(-3) : [];

  // Detect "label rows" — rows where the first cell looks like a
  // non-data label (non-numeric, non-date, non-empty, short string).
  const labelRows: Record<string, any>[] = [];
  const firstKey = headers[0];
  for (let i = 8; i < rows.length - 3; i++) {
    const val = rows[i]?.[firstKey];
    if (!val) continue;
    const s = String(val).trim();
    if (s.length === 0) continue;
    // Not a number, not a date-like string, and short
    if (!isNaN(Number(s))) continue;
    if (/^\d{4}[/-]\d{2}[/-]\d{2}/.test(s)) continue;
    if (s.length < 50) {
      labelRows.push(rows[i]);
      if (labelRows.length >= 5) break; // cap
    }
  }

  // Deduplicate: remove any last3 rows that are already in first8
  const seen = new Set(first8.map((r) => JSON.stringify(r)));
  const uniqueLast3 = last3.filter((r) => !seen.has(JSON.stringify(r)));
  const uniqueLabels = labelRows.filter((r) => !seen.has(JSON.stringify(r)));

  return {
    headers,
    sample: [...first8, ...uniqueLabels, ...uniqueLast3],
  };
}

function buildStructurePrompt(fingerprint: {
  headers: string[];
  sample: Record<string, any>[];
}): string {
  return `You are a spreadsheet structure analyzer. Given the column headers and a sample of rows from a financial spreadsheet, determine the sheet's structure and return a JSON ruleset.

Column Headers: ${JSON.stringify(fingerprint.headers)}
Sample Rows (first 8 rows, any detected label rows from the middle, last 3 rows):
${JSON.stringify(fingerprint.sample, null, 2)}

IMPORTANT INSTRUCTIONS:
- Analyze the sheet sample carefully before responding.
- Detect the orientation of the sheet:
  - If it's a standard format where each row is a transaction, set "orientation": "vertical".
  - If it's transposed (each column is a transaction, e.g., row 1 = descriptions, row 2 = amounts), set "orientation": "horizontal".
- If orientation is "horizontal", imagine the data is transposed so the first column becomes the new headers. Map the "columns" indices to these new headers (e.g., if the first column has 'Description' at row 0 and 'Amount' at row 1, then columns.description=0, columns.amount=1). The dataStartRow and dataEndRow will apply to the transposed rows (which were originally columns).
- Support Arabic and English column names equally.
- Column indices are 0-based and correspond to the order of the Column Headers array above.
- If income/expense is expressed as positive/negative numbers in a single amount column, set "directionFromSign": true and "columns.direction": null.
- If there are separate debit/credit columns, set "amountMode": "debit_credit" and populate "columns.debit" and "columns.credit" with their column indices.
- Identify and exclude summary/total rows at the bottom by setting "dataEndRow" to the correct 0-based row index (exclusive). Use "last" if data goes to the end.
- Identify mid-sheet label rows (section headers like "May Expenses", "مصاريف مايو") and add their patterns to "skipRowWhere.valueMatchesAny".
- Always include these in "skipRowWhere.valueMatchesAny": ["total", "إجمالي", "المجموع", "subtotal", "الإجمالي"]
- Build "categoryMap" based on actual values found in the sample rows, mapping them to valid categories.
- Build "directionMap" based on actual direction/type values found in the sample rows.
- If there is no category column, build "descriptionToCategoryRules" based on the actual description values in the sample rows. It should map keywords found in the descriptions to valid categories. It should recognize Arabic keywords too.
- Return ONLY a raw JSON object — no markdown fences, no prose, no explanation.
- Every field must have a value — use null for missing columns, never omit a field.

Valid categories to map to:
Income: "Sales Revenue", "Pop-up/Bazaar Sales", "Wholesale/B2B", "Supplier Refund", "Other"
Expense: "Raw Materials", "Packaging", "Logistics (Shipping)", "Ads", "Content Creation", "Other"

Return this exact JSON shape:
{
  "orientation": "vertical" | "horizontal",
  "dataStartRow": number,
  "dataEndRow": number | "last",
  "skipRowWhere": {
    "columnIndex": number,
    "valueMatchesAny": ["total", "إجمالي", "المجموع", "subtotal", "الإجمالي", ...]
  },
  "skipEmptyAmounts": true,
  "amountMode": "single" | "debit_credit",
  "columns": {
    "date": number | null,
    "description": number | null,
    "amount": number | null,
    "debit": number | null,
    "credit": number | null,
    "direction": number | null,
    "category": number | null,
    "paymentMethod": number | null
  },
  "directionMap": {
    "in": "INCOME",
    "out": "EXPENSE",
    "income": "INCOME",
    "expense": "EXPENSE",
    "دخل": "INCOME",
    "مصروف": "EXPENSE",
    "إيراد": "INCOME",
    "مدفوعات": "EXPENSE"
  },
  "directionFromSign": boolean,
  "categoryMap": { "raw_value": "Valid Category" },
  "descriptionToCategoryRules": [
    { "keywords": ["fabric", "material", "شحن"], "category": "Raw Materials" }
  ],
  "defaultPaymentMethod": "CASH" | "CARD" | "INSTAPAY" | "COD"
}`;
}

async function detectStructure(
  groq: Groq,
  fingerprint: { headers: string[]; sample: Record<string, any>[] }
): Promise<SheetRuleset | null> {
  const prompt = buildStructurePrompt(fingerprint);

  let responseText = "";
  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    });
    responseText = completion.choices[0]?.message?.content ?? "";
  } catch (err: any) {
    console.warn(
      "🟡 [CSV Pass1] Groq JSON mode failed, retrying without response_format:",
      err.message
    );
    try {
      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
      });
      responseText = completion.choices[0]?.message?.content ?? "";
    } catch (retryErr: any) {
      console.error("🔴 [CSV Pass1] Groq retry also failed:", retryErr.message);
      return null;
    }
  }

  responseText = responseText
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  if (!responseText) return null;

  try {
    const parsed = JSON.parse(responseText) as SheetRuleset;

    // Sanity-check required fields with null fallbacks
    return {
      orientation: parsed.orientation === "horizontal" ? "horizontal" : "vertical",
      dataStartRow: typeof parsed.dataStartRow === "number" ? parsed.dataStartRow : 1,
      dataEndRow: parsed.dataEndRow ?? "last",
      skipRowWhere: parsed.skipRowWhere ?? null,
      skipEmptyAmounts: parsed.skipEmptyAmounts !== false,
      amountMode: parsed.amountMode === "debit_credit" ? "debit_credit" : "single",
      columns: {
        date: parsed.columns?.date ?? null,
        description: parsed.columns?.description ?? null,
        amount: parsed.columns?.amount ?? null,
        debit: parsed.columns?.debit ?? null,
        credit: parsed.columns?.credit ?? null,
        direction: parsed.columns?.direction ?? null,
        category: parsed.columns?.category ?? null,
        paymentMethod: parsed.columns?.paymentMethod ?? null,
      },
      directionMap: parsed.directionMap ?? {},
      directionFromSign: parsed.directionFromSign === true,
      categoryMap: parsed.categoryMap ?? {},
      descriptionToCategoryRules: Array.isArray(parsed.descriptionToCategoryRules) ? parsed.descriptionToCategoryRules : [],
      defaultPaymentMethod: VALID_PAYMENT_METHODS.includes(parsed.defaultPaymentMethod)
        ? (parsed.defaultPaymentMethod as "CASH" | "CARD" | "INSTAPAY" | "COD")
        : "CASH",
    };
  } catch (e) {
    console.error("🔴 [CSV Pass1] Failed to parse ruleset JSON:", e);
    return null;
  }
}

// ────────────────────────────────────────────────────────────────────
// Pass 2 — Deterministic extraction using the ruleset
// ────────────────────────────────────────────────────────────────────

function parseDate(raw: any): string {
  if (!raw) return new Date().toISOString().split("T")[0];
  const s = String(raw).trim();
  if (!s) return new Date().toISOString().split("T")[0];

  // Excel serial date
  const num = Number(s);
  if (!isNaN(num) && num > 10000 && num < 100000) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(excelEpoch.getTime() + num * 86400000);
    return d.toISOString().split("T")[0];
  }

  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split("T")[0];
  }

  return new Date().toISOString().split("T")[0];
}

function parseAmount(raw: any): number {
  if (raw == null) return 0;
  const s = String(raw).replace(/[^0-9.\-]/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function lookupCaseInsensitive(
  map: Record<string, string>,
  key: string
): string | null {
  const lower = key.toLowerCase().trim();
  for (const [k, v] of Object.entries(map)) {
    if (k.toLowerCase().trim() === lower) return v;
  }
  return null;
}

function mapCategory(
  raw: string,
  categoryMap: Record<string, string>
): string {
  if (!raw || !raw.trim()) return "Other";

  // Try AI-built map first
  const mapped = lookupCaseInsensitive(categoryMap, raw);
  if (mapped) {
    const valid = VALID_CATEGORIES.find(
      (c) => c.toLowerCase() === mapped.toLowerCase()
    );
    if (valid) return valid;
  }

  // Hardcoded fallback
  const hardcoded: Record<string, string> = {
    sales: "Sales Revenue",
    "b2c sales": "Sales Revenue",
    "b2b sales": "Wholesale/B2B",
    materials: "Raw Materials",
    logistics: "Logistics (Shipping)",
    shipping: "Logistics (Shipping)",
    marketing: "Ads",
    production: "Raw Materials",
    operations: "Other",
    مواد: "Raw Materials",
    شحن: "Logistics (Shipping)",
    إعلانات: "Ads",
    تغليف: "Packaging",
    مبيعات: "Sales Revenue",
  };

  const hc = hardcoded[raw.toLowerCase().trim()];
  if (hc) return hc;

  // Direct match against valid categories
  const direct = VALID_CATEGORIES.find(
    (c) => c.toLowerCase() === raw.toLowerCase().trim()
  );
  if (direct) return direct;

  return "Other";
}

function extractTransactions(
  headers: string[],
  rows: Record<string, any>[],
  ruleset: SheetRuleset
): any[] {
  // ── Transpose if horizontal ──
  if (ruleset.orientation === "horizontal" && headers.length > 0) {
    const tHeaders: string[] = [headers[0]];
    for (const row of rows) {
      const val = row[headers[0]];
      tHeaders.push(val ? String(val).trim() : `Column_${tHeaders.length}`);
    }

    const tRows: Record<string, any>[] = [];
    for (let i = 1; i < headers.length; i++) {
      const originalHeader = headers[i];
      const newRow: Record<string, any> = {};
      newRow[tHeaders[0]] = originalHeader;
      for (let r = 0; r < rows.length; r++) {
        newRow[tHeaders[r + 1]] = rows[r][originalHeader];
      }
      tRows.push(newRow);
    }
    
    headers = tHeaders;
    rows = tRows;
  }

  const transactions: any[] = [];

  // Determine row range
  const startRow = ruleset.dataStartRow;
  const endRow =
    ruleset.dataEndRow === "last" ? rows.length : ruleset.dataEndRow;

  // Pre-build lowercase skip values
  const skipValues = (ruleset.skipRowWhere?.valueMatchesAny ?? []).map((v) =>
    v.toLowerCase().trim()
  );
  const skipColIdx = ruleset.skipRowWhere?.columnIndex ?? 0;
  const skipColHeader = headers[skipColIdx] ?? headers[0];

  for (let i = startRow; i < endRow; i++) {
    const row = rows[i];
    if (!row || Object.keys(row).length === 0) continue;

    // Get cell values by column index (using headers array order)
    const cellByIdx = (idx: number | null): any => {
      if (idx == null || idx < 0 || idx >= headers.length) return null;
      return row[headers[idx]] ?? null;
    };

    // ── Skip row check ──
    if (skipValues.length > 0) {
      const checkVal = String(cellByIdx(skipColIdx) ?? "")
        .toLowerCase()
        .trim();
      if (checkVal && skipValues.some((sv) => checkVal.includes(sv))) {
        continue;
      }
    }

    // ── Amount ──
    let amount = 0;
    let type: "INCOME" | "EXPENSE" = "EXPENSE";
    let inferredFields = 0;
    let defaultedFields = 0;

    if (ruleset.amountMode === "debit_credit") {
      const debitRaw = cellByIdx(ruleset.columns.debit);
      const creditRaw = cellByIdx(ruleset.columns.credit);
      const debitAmt = parseAmount(debitRaw);
      const creditAmt = parseAmount(creditRaw);

      if (creditAmt > 0) {
        amount = creditAmt;
        type = "INCOME";
      } else if (debitAmt > 0) {
        amount = debitAmt;
        type = "EXPENSE";
      } else {
        // Both empty or zero
        if (ruleset.skipEmptyAmounts) continue;
        defaultedFields++;
      }
    } else {
      // single amount mode
      const rawAmt = parseAmount(cellByIdx(ruleset.columns.amount));

      if (rawAmt === 0 && ruleset.skipEmptyAmounts) continue;

      if (ruleset.directionFromSign) {
        type = rawAmt >= 0 ? "INCOME" : "EXPENSE";
        amount = Math.abs(rawAmt);
      } else {
        amount = Math.abs(rawAmt);
        // Direction from direction column
        const dirRaw = cellByIdx(ruleset.columns.direction);
        if (dirRaw) {
          const dirMapped = lookupCaseInsensitive(
            ruleset.directionMap,
            String(dirRaw)
          );
          if (dirMapped === "INCOME" || dirMapped === "EXPENSE") {
            type = dirMapped;
          } else {
            // Try common fallbacks
            const lower = String(dirRaw).toLowerCase().trim();
            if (
              lower.includes("income") ||
              lower.includes("credit") ||
              lower.includes("in") ||
              lower.includes("دخل") ||
              lower.includes("إيراد")
            ) {
              type = "INCOME";
              inferredFields++;
            } else {
              type = "EXPENSE";
              inferredFields++;
            }
          }
        } else {
          // No direction info at all — default to EXPENSE
          type = "EXPENSE";
          defaultedFields++;
        }
      }
    }

    // ── Date ──
    const dateRaw = cellByIdx(ruleset.columns.date);
    const dateStr = parseDate(dateRaw);
    const dateClean = dateRaw != null && dateStr !== new Date().toISOString().split("T")[0];
    if (!dateClean) inferredFields++;

    // ── Description ──
    const descRaw = cellByIdx(ruleset.columns.description);
    const description = descRaw ? String(descRaw).trim() : "Imported transaction";
    if (!descRaw) defaultedFields++;

    // ── Category ──
    const catRaw = cellByIdx(ruleset.columns.category);
    let category = "Other";
    if (catRaw) {
      category = mapCategory(String(catRaw), ruleset.categoryMap);
    } else {
      defaultedFields++;
      
      // Apply description-to-category rules
      const descLower = description.toLowerCase();
      const matchedRule = ruleset.descriptionToCategoryRules.find(rule => 
        rule.keywords.some(kw => descLower.includes(kw.toLowerCase()))
      );
      
      if (matchedRule && VALID_CATEGORIES.includes(matchedRule.category)) {
        category = matchedRule.category;
        defaultedFields--; // It's no longer purely defaulted, it was inferred
        inferredFields++;
      }
    }

    // ── Payment Method ──
    const pmRaw = cellByIdx(ruleset.columns.paymentMethod);
    let paymentMethod = ruleset.defaultPaymentMethod;
    if (pmRaw) {
      const pmStr = String(pmRaw).toUpperCase().trim();
      if (pmStr.includes("CARD")) paymentMethod = "CARD";
      else if (pmStr.includes("INSTAPAY")) paymentMethod = "INSTAPAY";
      else if (pmStr.includes("COD")) paymentMethod = "COD";
      else if (pmStr.includes("CASH")) paymentMethod = "CASH";
    }

    // ── COD never valid for expenses ──
    if (type === "EXPENSE" && paymentMethod === "COD") {
      paymentMethod = "CASH";
    }

    // ── Confidence scoring ──
    let confidence: "high" | "medium" | "low" = "high";
    let confidenceNote: string | null = null;
    if (defaultedFields >= 2) {
      confidence = "low";
      confidenceNote = "Multiple fields could not be extracted and were defaulted.";
    } else if (inferredFields > 0 || defaultedFields > 0) {
      confidence = "medium";
      confidenceNote = "Some fields were inferred from defaults.";
    }

    transactions.push({
      date: dateStr,
      description,
      amount,
      type,
      category,
      paymentMethod,
      confidence,
      confidenceNote,
    });
  }

  return transactions;
}

// ────────────────────────────────────────────────────────────────────
// Pass 1 Alternative — Direct One-Pass Extraction (for <= 200 rows)
// ────────────────────────────────────────────────────────────────────

async function extractTransactionsDirect(groq: Groq, headers: string[], rows: Record<string, any>[]): Promise<any[]> {
  // Format sheet as text table
  let tableStr = headers.join(" | ") + "\n" + headers.map(() => "---").join(" | ") + "\n";
  for (const row of rows) {
    const rowValues = headers.map(h => {
      const v = row[h];
      return v !== null && v !== undefined ? String(v).trim() : "";
    });
    tableStr += rowValues.join(" | ") + "\n";
  }

  const todayDate = new Date().toISOString().split('T')[0];

  const prompt = `This is a financial spreadsheet from an Egyptian clothing brand. It may have any structure — vertical, horizontal, Arabic, English, mixed, with or without headers, with summary rows, with merged cells. 
Read the entire sheet, understand what it contains, and extract every financial transaction you can identify.

Valid categories to map to:
Income: "Sales Revenue", "Pop-up/Bazaar Sales", "Wholesale/B2B", "Supplier Refund", "Other"
Expense: "Raw Materials", "Packaging", "Logistics (Shipping)", "Ads", "Content Creation", "Other"

Valid payment methods: "CASH", "CARD", "INSTAPAY", "COD"

If no date is provided for a transaction, use today's date in YYYY-MM-DD format: ${todayDate}

Return ONLY a JSON object containing a "transactions" array with this exact schema for each transaction:
{
  "date": "YYYY-MM-DD", // default to ${todayDate} if unknown
  "description": string, // map to "Unknown charge" if missing
  "amount": number, // positive absolute value
  "type": "INCOME" | "EXPENSE",
  "category": string, // map to one of the Valid categories
  "paymentMethod": string, // default "CASH". Cannot be COD for EXPENSE
  "confidence": "high" | "medium" | "low", // use medium/low if fields were defaulted
  "confidenceNote": string | null
}

Data:
${tableStr}`;

  let responseText = "";
  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    });
    responseText = completion.choices[0]?.message?.content ?? "";
  } catch (err: any) {
    console.warn("🔴 [CSV Direct] Groq JSON mode failed, retrying without response_format:", err.message);
    try {
      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
      });
      responseText = completion.choices[0]?.message?.content ?? "";
    } catch (retryErr: any) {
      console.error("🔴 [CSV Direct] Groq retry also failed:", retryErr.message);
      return [];
    }
  }

  responseText = responseText.replace(/```json/gi, "").replace(/```/g, "").trim();
  if (!responseText) return [];

  try {
    const parsed = JSON.parse(responseText);
    return Array.isArray(parsed.transactions) ? parsed.transactions : [];
  } catch (e) {
    console.error("🔴 [CSV Direct] Failed to parse transactions JSON:", e);
    return [];
  }
}

// ────────────────────────────────────────────────────────────────────
// Route handler
// ────────────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug } = await params;
    
    // Resolve organization and membership
    const org = await prisma.organization.findUnique({
      where: { slug },
      include: {
        memberships: {
          include: { user: true }
        }
      }
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const isSuperAdmin = !!process.env.SUPER_ADMIN_EMAIL && session.user.email === process.env.SUPER_ADMIN_EMAIL;
    const membership = org.memberships.find((m: any) => m.user.email === session.user?.email);
    
    if (!membership && !isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { tag, headers, rows } = body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ transactions: [] });
    }

    const allTransactions: any[] = [];

    if (tag === "shopify") {
      // Deterministic Shopify parsing — UNTOUCHED
      const grouped = groupShopifyRows(rows) as any[];
      for (const t of grouped) {
        let fStatus = "UNFULFILLED";
        if (t.finStatus === "refunded") {
            fStatus = "RETURNED";
        } else if (t.fulfillmentStatus === "fulfilled") {
            fStatus = "DELIVERED";
        } else if (t.fulfillmentStatus === "unfulfilled") {
            fStatus = "UNFULFILLED";
        } else if (t.fulfillmentStatus === "in transit" || t.fulfillmentStatus === "partial") {
            fStatus = "SHIPPED";
        }

        allTransactions.push({
          date: t.date ? new Date(t.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          description: `Shopify Order #${t.shopifyOrderId}`,
          amount: parseFloat(t.amount) || 0,
          type: "INCOME",
          category: "Sales Revenue",
          paymentMethod: ["CASH", "CARD", "INSTAPAY", "COD"].includes(t.paymentMethod) ? t.paymentMethod : "CARD",
          fulfillmentStatus: fStatus,
          confidence: "high",
          confidenceNote: null
        });
      }
    } else {
      // ═══════════════════════════════════════════════════════════════
      // Flexible path — Two-Pass Structure Detection
      // ═══════════════════════════════════════════════════════════════

      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) {
        return NextResponse.json({ error: "GROQ_API_KEY is not configured" }, { status: 500 });
      }
      const groq = new Groq({ apiKey });

      if (rows.length <= 200) {
        // ═══════════════════════════════════════════════════════════════
        // Flexible path — Direct One-Pass Extraction (<= 200 rows)
        // ═══════════════════════════════════════════════════════════════
        console.log(`📋 [CSV Direct] Sending ${rows.length} rows directly to Groq for one-pass extraction.`);
        const directTransactions = await extractTransactionsDirect(groq, headers, rows);
        allTransactions.push(...directTransactions);
        console.log(`✅ [CSV Direct] Extracted ${directTransactions.length} transactions via one-pass`);
      } else {
        // ═══════════════════════════════════════════════════════════════
        // Flexible path — Two-Pass Structure Detection (> 200 rows)
        // ═══════════════════════════════════════════════════════════════
        console.log(`📋 [CSV Pass1] Fallback two-pass extraction for large sheet (${rows.length} rows)`);
        
        const fingerprint = buildFingerprint(headers, rows);
        const ruleset = await detectStructure(groq, fingerprint);

        if (!ruleset) {
          console.error("🔴 [CSV] Structure detection failed — returning empty");
          return NextResponse.json({
            transactions: [],
            error: "Failed to analyze spreadsheet structure. Please try a different format.",
          });
        }

        const extracted = extractTransactions(headers, rows, ruleset);
        allTransactions.push(...extracted);
        console.log(`✅ [CSV Pass2] Extracted ${extracted.length} transactions from ${rows.length} rows`);
      }
    }

    return NextResponse.json({ transactions: allTransactions });

  } catch (error: any) {
    console.error("analyze-csv error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
