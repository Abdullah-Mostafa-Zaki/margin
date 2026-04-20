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

type VoiceActionResult =
  | { success: true; data: ParsedTransaction }
  | { success: false; error: string };

/**
 * Sends audio to Gemini 1.5 Flash for transcription and structured extraction.
 * Returns a strongly-typed transaction object ready for form auto-fill.
 */
export async function parseVoiceTransaction(
  base64Audio: string,
  mimeType: string
): Promise<VoiceActionResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { success: false, error: "GEMINI_API_KEY is not configured." };
  }

  // Guard: reject silent or too-short recordings before wasting an API call
  if (!base64Audio || base64Audio.length < 100) {
    return { success: false, error: "Audio was too short or silent. Please speak clearly and try again." };
  }

  try {
    // Normalize MIME: Safari sometimes sends video/mp4 for audio-only recordings
    let normalizedMime = mimeType;
    if (normalizedMime.includes("mp4")) {
      normalizedMime = "audio/mp4";
    }

    console.log("🚀 [MODEL-SWAP] ACTIVE MODEL: gemini-3.1-flash-lite");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite",
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
                mimeType: normalizedMime,
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

    const text = result.response.text();
    const parsed: ParsedTransaction = JSON.parse(text);

    // Validate and sanitize the response
    if (!parsed.amount || typeof parsed.amount !== "number" || parsed.amount <= 0) {
      return { success: false, error: "Could not extract a valid amount from your voice. Please try again." };
    }

    if (!["INCOME", "EXPENSE"].includes(parsed.type)) {
      parsed.type = "EXPENSE";
    }

    if (!["CASH", "CARD", "COD", "INSTAPAY"].includes(parsed.paymentMethod)) {
      parsed.paymentMethod = "CASH";
    }

    // Validate date format (YYYY-MM-DD)
    const today2 = new Date().toLocaleDateString("en-CA");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) {
      parsed.date = today2;
    }

    return { success: true, data: parsed };
  } catch (error: any) {
    console.error("AI Processing Error:", error);

    // Detect rate-limit / quota errors (HTTP 429)
    const isRateLimit =
      error?.status === 429 ||
      error?.message?.toLowerCase().includes("rate") ||
      error?.message?.toLowerCase().includes("quota") ||
      error?.message?.toLowerCase().includes("resource_exhausted");

    if (isRateLimit) {
      return {
        success: false,
        error: "AI service is currently busy or rate-limited. Please try typing your transaction or wait a minute.",
      };
    }

    return {
      success: false,
      error: error?.message || "Voice processing failed. Please try again.",
    };
  }
}
