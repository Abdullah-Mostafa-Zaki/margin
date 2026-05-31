import Groq from "groq-sdk";
import dotenv from "dotenv";
dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function extractTransactionsDirect(headers, rows) {
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

  console.log("Calling Groq...");
  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });

  const responseText = completion.choices[0]?.message?.content ?? "";
  const parsed = JSON.parse(responseText.replace(/```json/gi, "").replace(/```/g, "").trim());
  return parsed.transactions || [];
}

async function runTests() {
  console.log("\n═══ TEST 1: Transposed Horizontal Sheet ═══\n");
  const test1Headers = ["Description", "Fabric Sourcing", "Website Sales", "Facebook Ads"];
  const test1Rows = [
    { "Description": "Amount", "Fabric Sourcing": "-2500", "Website Sales": "4500", "Facebook Ads": "-800" }
  ];
  const res1 = await extractTransactionsDirect(test1Headers, test1Rows);
  console.log(JSON.stringify(res1, null, 2));

  console.log("\n═══ TEST 2: Dummy Arabic Sheet ═══\n");
  const test2Headers = ["التاريخ", "البيان", "المبلغ", "النوع", "الفئة"];
  const test2Rows = [
    { "التاريخ": "2026-05-01", "البيان": "إعلانات فيسبوك", "المبلغ": "4000", "النوع": "مصروف", "الفئة": "إعلانات" },
    { "التاريخ": "2026-05-03", "البيان": "مبيعات أونلاين", "المبلغ": "15000", "النوع": "دخل", "الفئة": "مبيعات" },
    { "التاريخ": "2026-05-05", "البيان": "مورد تغليف", "المبلغ": "2000", "النوع": "مصروف", "الفئة": "تغليف" },
    { "التاريخ": "الإجمالي", "البيان": "", "المبلغ": "21000", "النوع": "", "الفئة": "" },
  ];
  const res2 = await extractTransactionsDirect(test2Headers, test2Rows);
  console.log(JSON.stringify(res2, null, 2));

  console.log("\n═══ TEST 3: Debit/Credit Sheet ═══\n");
  const test3Headers = ["Date", "Description", "Credit", "Debit", "Category"];
  const test3Rows = [
    { Date: "2026-05-01", Description: "Facebook Ads", Credit: "", Debit: "4000", Category: "Ads" },
    { Date: "2026-05-03", Description: "Online Sales", Credit: "15000", Debit: "", Category: "Sales" },
    { Date: "May Expenses", Description: "", Credit: "", Debit: "", Category: "" },
    { Date: "2026-05-05", Description: "Packaging Supplier", Credit: "", Debit: "2000", Category: "Packaging" },
    { Date: "2026-05-07", Description: "Wholesale Order", Credit: "22000", Debit: "", Category: "B2B Sales" },
  ];
  const res3 = await extractTransactionsDirect(test3Headers, test3Rows);
  console.log(JSON.stringify(res3, null, 2));
}

runTests().catch(console.error);
