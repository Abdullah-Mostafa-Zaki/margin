import Groq from "groq-sdk";
import { config } from "dotenv";

config({ path: "d:/Work/Projects/margin/.env.local" });

async function processChunk(groq, headers, chunkRows, chunkIndex, isRetry = false) {
  let tableStr = headers.join(" | ") + "\n" + headers.map(() => "---").join(" | ") + "\n";
  for (const row of chunkRows) {
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
Expense: "Raw Materials", "Manufacturing", "Packaging", "Logistics (Shipping)", "Ads", "Content Creation", "Facilities", "Subscriptions", "Salaries", "Taxes & Legal", "Returns & Refunds", "Other"

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
  let finishReason = "";

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" },
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });
    const choice = completion.choices[0];
    responseText = choice?.message?.content ?? "";
    finishReason = choice?.finish_reason ?? "";
  } catch (err) {
    console.warn(`🔴 [CSV Direct] Chunk ${chunkIndex} Groq JSON mode failed, retrying without response_format:`, err.message);
    try {
      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        max_tokens: 8192,
        messages: [{ role: "user", content: prompt }],
      });
      const choice = completion.choices[0];
      responseText = choice?.message?.content ?? "";
      finishReason = choice?.finish_reason ?? "";
    } catch (retryErr) {
      console.error(`🔴 [CSV Direct] Chunk ${chunkIndex} Groq retry also failed:`, retryErr.message);
      return [];
    }
  }

  if (finishReason === "length") {
    if (!isRetry && chunkRows.length > 1) {
      console.warn(`🟡 [CSV Direct] Chunk ${chunkIndex} truncated (finish_reason=length). Retrying by splitting ${chunkRows.length} rows in half.`);
      const mid = Math.floor(chunkRows.length / 2);
      const half1 = await processChunk(groq, headers, chunkRows.slice(0, mid), chunkIndex + 0.1, true);
      const half2 = await processChunk(groq, headers, chunkRows.slice(mid), chunkIndex + 0.2, true);
      return [...half1, ...half2];
    } else {
      console.error(`🔴 [CSV Direct] Chunk ${chunkIndex} STILL truncated after retry (or single row). Proceeding with truncated data.`);
    }
  }

  responseText = responseText.replace(/```json/gi, "").replace(/```/g, "").trim();
  if (!responseText) return [];

  try {
    const parsed = JSON.parse(responseText);
    let txs = Array.isArray(parsed.transactions) ? parsed.transactions : [];
    
    if (finishReason === "length" && isRetry) {
      txs = txs.map(tx => ({
        ...tx,
        confidence: "low",
        confidenceNote: "Row may be incomplete due to processing limits — please review"
      }));
    }
    
    console.log(`✅ [CSV Direct] Chunk ${chunkIndex} parsed ${txs.length} transactions (finish_reason: ${finishReason})`);
    return txs;
  } catch (e) {
    console.error(`🔴 [CSV Direct] Chunk ${chunkIndex} failed to parse transactions JSON:`, e.message);
    return [];
  }
}

async function extractTransactionsDirect(groq, headers, rows) {
  const CHUNK_SIZE = 75;
  const allTransactions = [];
  
  console.log(`📋 [CSV Direct] Processing ${rows.length} rows in chunks of ${CHUNK_SIZE}...`);
  
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunkRows = rows.slice(i, i + CHUNK_SIZE);
    const chunkIndex = Math.floor(i / CHUNK_SIZE) + 1;
    
    console.log(`📋 [CSV Direct] Starting chunk ${chunkIndex} (rows ${i + 1} to ${Math.min(i + CHUNK_SIZE, rows.length)})`);
    const chunkTxs = await processChunk(groq, headers, chunkRows, chunkIndex);
    allTransactions.push(...chunkTxs);
  }
  
  console.log(`✅ [CSV Direct] Completed all chunks. Total extracted: ${allTransactions.length}`);
  return allTransactions;
}

async function testExtraction() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error("GROQ_API_KEY is missing");
    return;
  }
  const groq = new Groq({ apiKey });

  const headers = ["Date", "Description", "Amount", "Category"];
  const rows = [];
  for (let i = 0; i < 950; i++) {
    rows.push({
      Date: `2024-05-${(i % 28) + 1}`,
      Description: `Test transaction ${i}`,
      Amount: Math.floor(Math.random() * 1000) + 10,
      Category: "Raw Materials"
    });
  }

  const txs = await extractTransactionsDirect(groq, headers, rows);
  console.log(`\nFinal Verification: Sent 950 rows, got ${txs.length} transactions.`);
}

testExtraction();
