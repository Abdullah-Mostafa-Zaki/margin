import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import Groq from "groq-sdk";
import { groupShopifyRows } from "@/lib/utils/shopifyCsvGrouper";

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
      // Deterministic Shopify parsing
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
      // Flexible path: AI mapping on headers + first 3 rows
      const sampleRows = rows.slice(0, 3);
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) {
        return NextResponse.json({ error: "GROQ_API_KEY is not configured" }, { status: 500 });
      }
      const groq = new Groq({ apiKey });

      const prompt = `You are a data mapper. Given the following CSV headers and first 3 rows of data, map the columns to the required standard transaction fields.
      
Headers: ${JSON.stringify(headers)}
Rows: ${JSON.stringify(sampleRows)}

Standard Fields needed:
- amountCol: The exact name of the column containing the transaction amount.
- descriptionCol: The exact name of the column containing the description or merchant.
- dateCol: The exact name of the column containing the date.
- typeCol: The exact name of the column containing transaction type (Income vs Expense), if any.
- typeIncomeValue: If typeCol exists, what value indicates INCOME (e.g. "Deposit", "Credit").
- typeExpenseValue: If typeCol exists, what value indicates EXPENSE (e.g. "Withdrawal", "Debit").
- categoryCol: The exact name of the column containing the category, if any.
- categoryValueMapping: A JSON object mapping the raw category values found in the CSV to our exact valid categories.
  Valid categories are ONLY: "Sales Revenue", "Pop-up/Bazaar Sales", "Wholesale/B2B", "Supplier Refund", "Raw Materials", "Packaging", "Logistics (Shipping)", "Ads", "Content Creation", "Other".
  Explicitly apply these mappings if you see them: "Sales" -> "Sales Revenue", "Materials" -> "Raw Materials", "Logistics" -> "Logistics (Shipping)", "Shipping" -> "Logistics (Shipping)", "Marketing" -> "Ads", "Production" -> "Raw Materials", "Operations" -> "Other". Include these exact mappings and any others you infer.
- paymentMethodCol: The exact name of the column containing the payment method, if any.

Return ONLY a JSON object exactly like this (use null if a column doesn't exist):
{
  "mappings": {
    "amountCol": string | null,
    "descriptionCol": string | null,
    "dateCol": string | null,
    "typeCol": string | null,
    "typeIncomeValue": string | null,
    "typeExpenseValue": string | null,
    "categoryCol": string | null,
    "paymentMethodCol": string | null,
    "categoryValueMapping": { "raw_value": "Valid Category" } | null
  }
}`;

      let mappingText = "";
      try {
        const completion = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: prompt }]
        });
        mappingText = completion.choices[0]?.message?.content ?? "";
      } catch (err: any) {
        console.warn("🟡 [CSV] Groq JSON mode failed, retrying without response_format:", err.message);
        const completion = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }]
        });
        mappingText = completion.choices[0]?.message?.content ?? "";
      }

      mappingText = mappingText.replace(/```json/gi, "").replace(/```/g, "").trim();
      let mapping: any = {};
      try {
        const parsed = JSON.parse(mappingText);
        mapping = parsed.mappings || {};
      } catch (e) {
        console.error("Failed to parse AI mappings:", e);
      }

      // Deterministic loop over full dataset
      for (const row of rows) {
        // Skip empty rows
        if (!row || Object.keys(row).length === 0) continue;

        let type = "EXPENSE"; // default
        if (mapping.typeCol && row[mapping.typeCol]) {
          const tVal = String(row[mapping.typeCol]).toLowerCase();
          const iVal = mapping.typeIncomeValue ? String(mapping.typeIncomeValue).toLowerCase() : null;
          const eVal = mapping.typeExpenseValue ? String(mapping.typeExpenseValue).toLowerCase() : null;
          
          if (iVal && tVal.includes(iVal)) {
            type = "INCOME";
          } else if (eVal && tVal.includes(eVal)) {
            type = "EXPENSE";
          } else if (tVal.includes("deposit") || tVal.includes("credit") || tVal.includes("income")) {
            type = "INCOME";
          }
        }

        let amount = 0;
        if (mapping.amountCol && row[mapping.amountCol]) {
          // Remove non-numeric except . and -
          const parsedAmt = parseFloat(String(row[mapping.amountCol]).replace(/[^0-9.-]/g, ''));
          if (!isNaN(parsedAmt)) amount = Math.abs(parsedAmt);
        }

        let dateStr = new Date().toISOString().split('T')[0];
        if (mapping.dateCol && row[mapping.dateCol]) {
            const dVal = row[mapping.dateCol];
            if (!isNaN(Number(dVal)) && Number(dVal) > 10000 && Number(dVal) < 100000) {
               // Excel serial date (days since Dec 30, 1899)
               const excelEpoch = new Date(Date.UTC(1899, 11, 30));
               const d = new Date(excelEpoch.getTime() + Number(dVal) * 86400000);
               dateStr = d.toISOString().split('T')[0];
            } else {
               const d = new Date(dVal);
               if (!isNaN(d.getTime())) {
                   dateStr = d.toISOString().split('T')[0];
               }
            }
        }

        let paymentMethod = "CASH";
        if (mapping.paymentMethodCol && row[mapping.paymentMethodCol]) {
           const pStr = String(row[mapping.paymentMethodCol]).toUpperCase();
           if (pStr.includes("CARD")) paymentMethod = "CARD";
           else if (pStr.includes("INSTAPAY")) paymentMethod = "INSTAPAY";
           else if (pStr.includes("COD")) paymentMethod = "COD";
        }

        // COD never valid for expenses -- enforce server-side
        if (type === "EXPENSE" && paymentMethod === "COD") {
            paymentMethod = "CASH";
        }

        const validCategories = ["Sales Revenue", "Pop-up/Bazaar Sales", "Wholesale/B2B", "Supplier Refund", "Raw Materials", "Packaging", "Logistics (Shipping)", "Ads", "Content Creation", "Other"];
        let category = "Other";
        if (mapping.categoryCol && row[mapping.categoryCol]) {
            const rawCat = String(row[mapping.categoryCol]);
            let mappedCat = rawCat;
            
            if (mapping.categoryValueMapping) {
                // Try exact match first
                if (mapping.categoryValueMapping[rawCat]) {
                    mappedCat = mapping.categoryValueMapping[rawCat];
                } else {
                    // Try case-insensitive match
                    const lowerRaw = rawCat.toLowerCase();
                    for (const [key, val] of Object.entries(mapping.categoryValueMapping)) {
                        if (key.toLowerCase() === lowerRaw) {
                            mappedCat = String(val);
                            break;
                        }
                    }
                }
            }

            // Hardcoded fallback for known values if AI missed it
            const lowerRaw = rawCat.toLowerCase();
            const hardcodedMap: Record<string, string> = {
                "sales": "Sales Revenue",
                "b2c sales": "Sales Revenue",
                "b2b sales": "Wholesale/B2B",
                "materials": "Raw Materials",
                "logistics": "Logistics (Shipping)",
                "shipping": "Logistics (Shipping)",
                "marketing": "Ads",
                "production": "Raw Materials",
                "operations": "Other"
            };
            if (hardcodedMap[lowerRaw]) {
                mappedCat = hardcodedMap[lowerRaw];
            }

            const match = validCategories.find(c => c.toLowerCase() === mappedCat.toLowerCase());
            if (match) category = match;
        }

        allTransactions.push({
          date: dateStr,
          description: mapping.descriptionCol && row[mapping.descriptionCol] 
            ? String(row[mapping.descriptionCol]) 
            : "Imported transaction",
          amount,
          type,
          category,
          paymentMethod,
          confidence: "medium", // AI mapping on headers inherently has some risk
          confidenceNote: "Mapped automatically from CSV headers."
        });
      }
    }

    return NextResponse.json({ transactions: allTransactions });

  } catch (error: any) {
    console.error("analyze-csv error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
