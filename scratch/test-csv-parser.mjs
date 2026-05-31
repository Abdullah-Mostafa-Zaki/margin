/**
 * Test script for the refactored two-pass CSV analyzer.
 *
 * Simulates the Pass 2 (deterministic extraction) logic using
 * hardcoded rulesets that mirror what Groq would return for each test case.
 *
 * Run:  node scratch/test-csv-parser.mjs
 */

// ── Valid categories & helpers ─────────────────────────────────────

const VALID_CATEGORIES = [
  "Sales Revenue", "Pop-up/Bazaar Sales", "Wholesale/B2B", "Supplier Refund",
  "Raw Materials", "Packaging", "Logistics (Shipping)", "Ads", "Content Creation", "Other",
];

function parseDate(raw) {
  if (!raw) return new Date().toISOString().split("T")[0];
  const s = String(raw).trim();
  if (!s) return new Date().toISOString().split("T")[0];
  const num = Number(s);
  if (!isNaN(num) && num > 10000 && num < 100000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(epoch.getTime() + num * 86400000).toISOString().split("T")[0];
  }
  const d = new Date(s);
  return !isNaN(d.getTime()) ? d.toISOString().split("T")[0] : new Date().toISOString().split("T")[0];
}

function parseAmount(raw) {
  if (raw == null) return 0;
  const s = String(raw).replace(/[^0-9.\-]/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function lookupCaseInsensitive(map, key) {
  const lower = key.toLowerCase().trim();
  for (const [k, v] of Object.entries(map)) {
    if (k.toLowerCase().trim() === lower) return v;
  }
  return null;
}

function mapCategory(raw, categoryMap) {
  if (!raw || !raw.trim()) return "Other";
  const mapped = lookupCaseInsensitive(categoryMap, raw);
  if (mapped) {
    const valid = VALID_CATEGORIES.find(c => c.toLowerCase() === mapped.toLowerCase());
    if (valid) return valid;
  }
  const hardcoded = {
    sales: "Sales Revenue", "b2c sales": "Sales Revenue", "b2b sales": "Wholesale/B2B",
    materials: "Raw Materials", logistics: "Logistics (Shipping)", shipping: "Logistics (Shipping)",
    marketing: "Ads", production: "Raw Materials", operations: "Other",
    "مواد": "Raw Materials", "شحن": "Logistics (Shipping)", "إعلانات": "Ads",
    "تغليف": "Packaging", "مبيعات": "Sales Revenue",
  };
  const hc = hardcoded[raw.toLowerCase().trim()];
  if (hc) return hc;
  const direct = VALID_CATEGORIES.find(c => c.toLowerCase() === raw.toLowerCase().trim());
  if (direct) return direct;
  return "Other";
}

function extractTransactions(headers, rows, ruleset) {
  if (ruleset.orientation === "horizontal" && headers.length > 0) {
    const tHeaders = [headers[0]];
    for (const row of rows) {
      const val = row[headers[0]];
      tHeaders.push(val ? String(val).trim() : `Column_${tHeaders.length}`);
    }

    const tRows = [];
    for (let i = 1; i < headers.length; i++) {
      const originalHeader = headers[i];
      const newRow = {};
      newRow[tHeaders[0]] = originalHeader;
      for (let r = 0; r < rows.length; r++) {
        newRow[tHeaders[r + 1]] = rows[r][originalHeader];
      }
      tRows.push(newRow);
    }
    
    headers = tHeaders;
    rows = tRows;
  }

  const transactions = [];
  const startRow = ruleset.dataStartRow;
  const endRow = ruleset.dataEndRow === "last" ? rows.length : ruleset.dataEndRow;
  const skipValues = (ruleset.skipRowWhere?.valueMatchesAny ?? []).map(v => v.toLowerCase().trim());
  const skipColIdx = ruleset.skipRowWhere?.columnIndex ?? 0;

  for (let i = startRow; i < endRow; i++) {
    const row = rows[i];
    if (!row || Object.keys(row).length === 0) continue;

    const cellByIdx = (idx) => {
      if (idx == null || idx < 0 || idx >= headers.length) return null;
      return row[headers[idx]] ?? null;
    };

    if (skipValues.length > 0) {
      const checkVal = String(cellByIdx(skipColIdx) ?? "").toLowerCase().trim();
      if (checkVal && skipValues.some(sv => checkVal.includes(sv))) continue;
    }

    let amount = 0;
    let type = "EXPENSE";
    let inferredFields = 0;
    let defaultedFields = 0;

    if (ruleset.amountMode === "debit_credit") {
      const debitAmt = parseAmount(cellByIdx(ruleset.columns.debit));
      const creditAmt = parseAmount(cellByIdx(ruleset.columns.credit));
      if (creditAmt > 0) { amount = creditAmt; type = "INCOME"; }
      else if (debitAmt > 0) { amount = debitAmt; type = "EXPENSE"; }
      else { if (ruleset.skipEmptyAmounts) continue; defaultedFields++; }
    } else {
      const rawAmt = parseAmount(cellByIdx(ruleset.columns.amount));
      if (rawAmt === 0 && ruleset.skipEmptyAmounts) continue;
      if (ruleset.directionFromSign) {
        type = rawAmt >= 0 ? "INCOME" : "EXPENSE";
        amount = Math.abs(rawAmt);
      } else {
        amount = Math.abs(rawAmt);
        const dirRaw = cellByIdx(ruleset.columns.direction);
        if (dirRaw) {
          const dirMapped = lookupCaseInsensitive(ruleset.directionMap, String(dirRaw));
          if (dirMapped === "INCOME" || dirMapped === "EXPENSE") { type = dirMapped; }
          else { type = "EXPENSE"; inferredFields++; }
        } else { type = "EXPENSE"; defaultedFields++; }
      }
    }

    const dateRaw = cellByIdx(ruleset.columns.date);
    const dateStr = parseDate(dateRaw);
    const dateClean = dateRaw != null && dateStr !== new Date().toISOString().split("T")[0];
    if (!dateClean) inferredFields++;

    const descRaw = cellByIdx(ruleset.columns.description);
    const description = descRaw ? String(descRaw).trim() : "Imported transaction";
    if (!descRaw) defaultedFields++;

    const catRaw = cellByIdx(ruleset.columns.category);
    let category = "Other";
    if (catRaw) {
      category = mapCategory(String(catRaw), ruleset.categoryMap);
    } else {
      defaultedFields++;
      
      const descLower = description.toLowerCase();
      const matchedRule = (ruleset.descriptionToCategoryRules || []).find(rule => 
        rule.keywords.some(kw => descLower.includes(kw.toLowerCase()))
      );
      
      if (matchedRule && VALID_CATEGORIES.includes(matchedRule.category)) {
        category = matchedRule.category;
        defaultedFields--;
        inferredFields++;
      }
    }

    let paymentMethod = ruleset.defaultPaymentMethod;
    const pmRaw = cellByIdx(ruleset.columns.paymentMethod);
    if (pmRaw) {
      const pmStr = String(pmRaw).toUpperCase().trim();
      if (pmStr.includes("CARD")) paymentMethod = "CARD";
      else if (pmStr.includes("INSTAPAY")) paymentMethod = "INSTAPAY";
      else if (pmStr.includes("COD")) paymentMethod = "COD";
      else if (pmStr.includes("CASH")) paymentMethod = "CASH";
    }
    if (type === "EXPENSE" && paymentMethod === "COD") paymentMethod = "CASH";

    let confidence = "high";
    let confidenceNote = null;
    if (defaultedFields >= 2) {
      confidence = "low";
      confidenceNote = "Multiple fields could not be extracted and were defaulted.";
    } else if (inferredFields > 0 || defaultedFields > 0) {
      confidence = "medium";
      confidenceNote = "Some fields were inferred from defaults.";
    }

    transactions.push({ date: dateStr, description, amount, type, category, paymentMethod, confidence, confidenceNote });
  }
  return transactions;
}

// ══════════════════════════════════════════════════════════════════
// Test 1 — Clean English sheet
// ══════════════════════════════════════════════════════════════════

console.log("\n═══ TEST 1: Clean English Sheet ═══\n");

const test1Headers = ["Date", "Description", "Amount", "Type", "Category"];
const test1Rows = [
  { Date: "2026-05-01", Description: "Facebook Ads", Amount: "4000", Type: "Expense", Category: "Marketing" },
  { Date: "2026-05-03", Description: "Online Sales", Amount: "15000", Type: "Income", Category: "Sales" },
  { Date: "2026-05-05", Description: "Packaging Supplier", Amount: "2000", Type: "Expense", Category: "Packaging" },
  { Date: "", Description: "", Amount: "21000", Type: "", Category: "" },  // Total row — first cell is ""
];
// But typically the total row has "Total" in first cell:
test1Rows[3] = { Date: "Total", Description: "", Amount: "21000", Type: "", Category: "" };

const test1Ruleset = {
  dataStartRow: 0,
  dataEndRow: "last",
  skipRowWhere: { columnIndex: 0, valueMatchesAny: ["total", "إجمالي", "المجموع", "subtotal", "الإجمالي"] },
  skipEmptyAmounts: true,
  amountMode: "single",
  columns: { date: 0, description: 1, amount: 2, debit: null, credit: null, direction: 3, category: 4, paymentMethod: null },
  directionMap: { income: "INCOME", expense: "EXPENSE", Income: "INCOME", Expense: "EXPENSE" },
  directionFromSign: false,
  categoryMap: { Marketing: "Ads", Sales: "Sales Revenue", Packaging: "Packaging" },
  defaultPaymentMethod: "CASH",
};

const test1Result = extractTransactions(test1Headers, test1Rows, test1Ruleset);
console.log(JSON.stringify(test1Result, null, 2));

// ══════════════════════════════════════════════════════════════════
// Test 2 — Arabic mixed sheet with summary row
// ══════════════════════════════════════════════════════════════════

console.log("\n═══ TEST 2: Arabic Mixed Sheet ═══\n");

const test2Headers = ["التاريخ", "البيان", "المبلغ", "النوع", "الفئة"];
const test2Rows = [
  { "التاريخ": "2026-05-01", "البيان": "إعلانات فيسبوك", "المبلغ": "4000", "النوع": "مصروف", "الفئة": "إعلانات" },
  { "التاريخ": "2026-05-03", "البيان": "مبيعات أونلاين", "المبلغ": "15000", "النوع": "دخل", "الفئة": "مبيعات" },
  { "التاريخ": "2026-05-05", "البيان": "مورد تغليف", "المبلغ": "2000", "النوع": "مصروف", "الفئة": "تغليف" },
  { "التاريخ": "الإجمالي", "البيان": "", "المبلغ": "21000", "النوع": "", "الفئة": "" },
];

const test2Ruleset = {
  dataStartRow: 0,
  dataEndRow: "last",
  skipRowWhere: { columnIndex: 0, valueMatchesAny: ["total", "إجمالي", "المجموع", "subtotal", "الإجمالي"] },
  skipEmptyAmounts: true,
  amountMode: "single",
  columns: { date: 0, description: 1, amount: 2, debit: null, credit: null, direction: 3, category: 4, paymentMethod: null },
  directionMap: { "دخل": "INCOME", "مصروف": "EXPENSE", "إيراد": "INCOME", "مدفوعات": "EXPENSE" },
  directionFromSign: false,
  categoryMap: { "إعلانات": "Ads", "مبيعات": "Sales Revenue", "تغليف": "Packaging" },
  defaultPaymentMethod: "CASH",
};

const test2Result = extractTransactions(test2Headers, test2Rows, test2Ruleset);
console.log(JSON.stringify(test2Result, null, 2));

// ══════════════════════════════════════════════════════════════════
// Test 3 — Debit/Credit columns with mid-sheet section label
// ══════════════════════════════════════════════════════════════════

console.log("\n═══ TEST 3: Debit/Credit with Section Labels ═══\n");

const test3Headers = ["Date", "Description", "Credit", "Debit", "Category"];
const test3Rows = [
  { Date: "2026-05-01", Description: "Facebook Ads", Credit: "", Debit: "4000", Category: "Ads" },
  { Date: "2026-05-03", Description: "Online Sales", Credit: "15000", Debit: "", Category: "Sales" },
  { Date: "May Expenses", Description: "", Credit: "", Debit: "", Category: "" },
  { Date: "2026-05-05", Description: "Packaging Supplier", Credit: "", Debit: "2000", Category: "Packaging" },
  { Date: "2026-05-07", Description: "Wholesale Order", Credit: "22000", Debit: "", Category: "B2B Sales" },
];

const test3Ruleset = {
  dataStartRow: 0,
  dataEndRow: "last",
  skipRowWhere: { columnIndex: 0, valueMatchesAny: ["total", "إجمالي", "المجموع", "subtotal", "الإجمالي", "may expenses"] },
  skipEmptyAmounts: true,
  amountMode: "debit_credit",
  columns: { date: 0, description: 1, amount: null, debit: 3, credit: 2, direction: null, category: 4, paymentMethod: null },
  directionMap: {},
  directionFromSign: false,
  categoryMap: { Ads: "Ads", Sales: "Sales Revenue", Packaging: "Packaging", "B2B Sales": "Wholesale/B2B" },
  defaultPaymentMethod: "CASH",
};

const test3Result = extractTransactions(test3Headers, test3Rows, test3Ruleset);
console.log(JSON.stringify(test3Result, null, 2));

// ── Summary ──
console.log("\n═══ SUMMARY ═══");
console.log(`Test 1: ${test1Result.length} transactions`);
console.log(`Test 2: ${test2Result.length} transactions`);
console.log(`Test 3: ${test3Result.length} transactions`);

// ══════════════════════════════════════════════════════════════════
// Test 4 — Simple Ins and Outs (No Category Column)
// ══════════════════════════════════════════════════════════════════

console.log("\n═══ TEST 4: Simple Ins and Outs (No Category Col) ═══\n");

const test4Headers = ["Description", "Amount"];
const test4Rows = [
  { Description: "Website Sales", Amount: "45000" },
  { Description: "Fabric Sourcing", Amount: "-8000" },
  { Description: "Shipping & Fulfillment", Amount: "-2500" },
  { Description: "Facebook Ads", Amount: "-4000" },
  { Description: "Bazaar pre-orders", Amount: "12000" },
  { Description: "Unknown charge", Amount: "-500" },
];

const test4Ruleset = {
  dataStartRow: 0,
  dataEndRow: "last",
  skipRowWhere: null,
  skipEmptyAmounts: true,
  amountMode: "single",
  columns: { date: null, description: 0, amount: 1, debit: null, credit: null, direction: null, category: null, paymentMethod: null },
  directionMap: {},
  directionFromSign: true,
  categoryMap: {},
  descriptionToCategoryRules: [
    { keywords: ["fabric", "material", "cotton"], category: "Raw Materials" },
    { keywords: ["shipping", "logistics", "fulfillment"], category: "Logistics (Shipping)" },
    { keywords: ["ads", "facebook", "marketing"], category: "Ads" },
    { keywords: ["sales", "website sales", "revenue"], category: "Sales Revenue" },
    { keywords: ["bazaar", "popup", "pop-up"], category: "Pop-up/Bazaar Sales" }
  ],
  defaultPaymentMethod: "CASH",
};

const test4Result = extractTransactions(test4Headers, test4Rows, test4Ruleset);
console.log(JSON.stringify(test4Result, null, 2));
console.log(`\nTest 4: ${test4Result.length} transactions`);

// ══════════════════════════════════════════════════════════════════
// Test 5 — Transposed Horizontal Sheet
// ══════════════════════════════════════════════════════════════════

console.log("\n═══ TEST 5: Transposed Horizontal Sheet ═══\n");

const test5Headers = ["Description", "Fabric Sourcing", "Website Sales", "Facebook Ads"];
const test5Rows = [
  { "Description": "Amount", "Fabric Sourcing": "-2500", "Website Sales": "4500", "Facebook Ads": "-800" }
];

const test5Ruleset = {
  orientation: "horizontal",
  dataStartRow: 0,
  dataEndRow: "last",
  skipRowWhere: null,
  skipEmptyAmounts: true,
  amountMode: "single",
  // In the transposed data, headers become: ["Description", "Amount"]
  // So description is at index 0, amount is at index 1
  columns: { date: null, description: 0, amount: 1, debit: null, credit: null, direction: null, category: null, paymentMethod: null },
  directionMap: {},
  directionFromSign: true,
  categoryMap: {},
  descriptionToCategoryRules: [
    { keywords: ["fabric"], category: "Raw Materials" },
    { keywords: ["sales"], category: "Sales Revenue" },
    { keywords: ["ads"], category: "Ads" }
  ],
  defaultPaymentMethod: "CASH",
};

const test5Result = extractTransactions(test5Headers, test5Rows, test5Ruleset);
console.log(JSON.stringify(test5Result, null, 2));
console.log(`\nTest 5: ${test5Result.length} transactions`);

