"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

interface ParsedTransaction {
  amount: number;
  type: "INCOME" | "EXPENSE";
  category: string;
  paymentMethod: "CASH" | "CARD" | "COD" | "INSTAPAY";
  date: string; // YYYY-MM-DD
  notes: string;
}

/**
 * Sends audio to Gemini 1.5 Flash for transcription and structured extraction.
 * Returns a strongly-typed transaction object ready for form auto-fill.
 */
export async function parseVoiceTransaction(
  base64Audio: string,
  mimeType: string
): Promise<ParsedTransaction> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  console.log("DEBUG: Calling Gemini with model gemini-1.5-flash-latest");
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash-latest",
  });

  // Dynamic date context so the model can resolve relative references
  const today = new Date();
  const currentDate = today.toLocaleDateString("en-CA"); // YYYY-MM-DD format

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayDate = yesterday.toLocaleDateString("en-CA");

  const systemPrompt = `You are a financial assistant for an Egyptian brand owner. Today's date is ${currentDate}. Yesterday's date is ${yesterdayDate}.

The user will speak in Egyptian Arabic (Ammiya) or a mix of Arabic and English. Your job is to extract transaction details from their voice and return ONLY a valid JSON object matching this exact schema:

{
  "amount": number,
  "type": "INCOME" | "EXPENSE",
  "category": string,
  "paymentMethod": "CASH" | "CARD" | "COD" | "INSTAPAY",
  "date": "YYYY-MM-DD",
  "notes": string
}

**Category Mapping Rules:**
- "قماش", "أماش", "amash", "raw materials", "خامات" → "Raw Materials"
- "تصنيع", "manufacturing" → "Manufacturing"
- "تغليف", "packaging", "باكدجينج" → "Packaging"
- "شحن", "شاحن", "logistics", "shipping" → "Logistics (Shipping)"
- "إعلانات", "ads", "فيسبوك", "ميتا", "facebook", "meta" → "Ads"
- "كونتنت", "content", "تصوير" → "Content Creation"
- "مبيعات", "sales", "أوردر", "order" → "Sales Revenue"
- If nothing matches → "Other"

**Payment Method Mapping:**
- "كاش", "cash", "نقدي" → "CASH"
- "كارت", "card", "فيزا", "visa" → "CARD"
- "إنستاباي", "instapay" → "INSTAPAY"
- "كاش أون ديليفري", "cod", "تحصيل" → "COD"
- Default → "CASH"

**Date Mapping:**
- "النهاردة", "today", "اليوم" → ${currentDate}
- "إمبارح", "امبارح", "yesterday" → ${yesterdayDate}
- If a specific date is mentioned, use it. Otherwise default to ${currentDate}.

**Type Inference:**
- If the user mentions buying, paying, spending, or any expense context → "EXPENSE"
- If the user mentions receiving money, sales, income, orders → "INCOME"
- Default → "EXPENSE"

**Notes:** Include a brief, clean Arabic or English summary of what the user said.

Return ONLY the JSON object. No explanation, no markdown.`;

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          { text: systemPrompt },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Audio,
            },
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
    },
  });

  const response = result.response;
  const text = response.text();

  try {
    const parsed: ParsedTransaction = JSON.parse(text);

    // Validate and sanitize the response
    if (!parsed.amount || typeof parsed.amount !== "number" || parsed.amount <= 0) {
      throw new Error("Could not extract a valid amount from your voice.");
    }

    if (!["INCOME", "EXPENSE"].includes(parsed.type)) {
      parsed.type = "EXPENSE";
    }

    if (!["CASH", "CARD", "COD", "INSTAPAY"].includes(parsed.paymentMethod)) {
      parsed.paymentMethod = "CASH";
    }

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) {
      parsed.date = currentDate;
    }

    return parsed;
  } catch (e: any) {
    if (e.message?.includes("Could not extract")) {
      throw e;
    }
    throw new Error("Failed to parse AI response. Please try again.");
  }
}
