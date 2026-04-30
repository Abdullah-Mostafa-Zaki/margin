"use server";

import Groq from "groq-sdk";

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
 * Two-step Groq pipeline:
 *   1. Whisper (whisper-large-v3)  — transcribes the raw audio
 *   2. Llama 3 (llama3-8b-8192)   — extracts structured JSON from the transcript
 *
 * Keeps the same function signature and return shape so the frontend is untouched.
 */
export async function parseVoiceTransaction(
  base64Audio: string,
  mimeType: string
): Promise<VoiceActionResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { success: false, error: "GROQ_API_KEY is not configured." };
  }

  // Guard: reject silent or too-short recordings before wasting an API call
  if (!base64Audio || base64Audio.length < 100) {
    return { success: false, error: "Audio was too short or silent. Please speak clearly and try again." };
  }

  try {
    const groq = new Groq({ apiKey });

    // ── Normalize MIME ────────────────────────────────────────────────────────
    // Safari sometimes sends video/mp4 for audio-only recordings.
    // Whisper accepts: mp3, mp4, mpeg, mpga, m4a, wav, webm, ogg, flac
    let normalizedMime = mimeType;
    if (normalizedMime.includes("mp4")) normalizedMime = "audio/mp4";

    // Derive the file extension Whisper needs from the MIME type
    const extMap: Record<string, string> = {
      "audio/webm":  "webm",
      "audio/mp4":   "mp4",
      "audio/mpeg":  "mp3",
      "audio/ogg":   "ogg",
      "audio/wav":   "wav",
      "audio/flac":  "flac",
      "audio/m4a":   "m4a",
    };
    const ext = extMap[normalizedMime] ?? "webm";
    const filename = `audio.${ext}`;

    // ── Phase 1: Transcription via Whisper ───────────────────────────────────
    console.log("🎙️ [GROQ] Phase 1 — Whisper transcription starting");

    const audioBuffer = Buffer.from(base64Audio, "base64");
    const audioFile   = new File([audioBuffer], filename, { type: normalizedMime });

    const transcription = await groq.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-large-v3",
      language: "ar",
      prompt: "جنيه مصري، قماش، خامات، إعلانات، شحن، إنستاباي، كاش، مبيعات، أوردر، اشتريت، دفعت، ألف، تالاف، جنيه.",
      temperature: 0,
    });

    const transcript = transcription.text?.trim();
    console.log("✅ [GROQ] Transcript:", transcript);

    if (!transcript) {
      return { success: false, error: "Could not transcribe audio. Please speak clearly and try again." };
    }

    // ── Dynamic date context ─────────────────────────────────────────────────
    const today = new Date();
    const currentDate   = today.toLocaleDateString("en-CA"); // YYYY-MM-DD

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDate = yesterday.toLocaleDateString("en-CA");

    // ── Phase 2: JSON Extraction via Llama 3 ────────────────────────────────
    console.log("🧠 [GROQ] Phase 2 — Llama 3 JSON extraction starting");

    const systemPrompt = `You are a financial assistant for an Egyptian brand owner. Today's date is ${currentDate}. Yesterday's date is ${yesterdayDate}.

The user will speak in Egyptian Arabic (Ammiya) or a mix of Arabic and English. Your job is to extract transaction details from their voice transcript and return ONLY a valid JSON object matching this exact schema:

{
  "amount": number, // Default: 0 if not found
  "type": "INCOME" | "EXPENSE", // Default: EXPENSE
  "category": string, // Default: Other
  "paymentMethod": "CASH" | "CARD" | "COD" | "INSTAPAY", // Default: CASH
  "date": "YYYY-MM-DD", // Default: ${currentDate}
  "notes": string
}

### Numerical Extraction Rules (Critical)
The transcript contains numbers written as text. Resolve them before saving:
- "ألف", "الف", "بألف" → 1000
- "ألفين", "الفين", "بألفين" → 2000
- "تالاف", "تلاف", "ثلاثة آلاف", "بتلاتالاف", "تلاتالاف" → 3000
- "خمسة آلاف", "خمس تالاف", "بخمستالاف", "بخمستلاف" → 5000
- Strip any leading 'ب' (e.g., "بخمستالاف" means 5000).

### Whisper Auto-Correct & Typo Tolerance (CRITICAL)
The voice transcript often mishears Egyptian Ammiya. Intelligently infer the intended term:
- "وماشي", "وماش", "اماش" → interpret as "قماش" (Raw Materials).
- "كيني", "جني", "جنية" → interpret as "جنيه" (Egyptian Pounds). Ignore Kenya.

### Category Mapping Rules
- "قماش", "أماش", "raw materials", "خامات", "أقمشة" → "Raw Materials"
- "تصنيع", "manufacturing", "مصنع", "تقفيل" → "Manufacturing"
- "تغليف", "packaging", "باكدجينج", "أكياس", "علب" → "Packaging"
- "شحن", "شاحن", "logistics", "shipping", "مندوب", "توصيل" → "Logistics (Shipping)"
- "إعلانات", "ads", "فيسبوك", "ميتا", "ممولة", "ads cost" → "Ads"
- "كونتنت", "content", "تصوير", "سيشن", "موديل" → "Content Creation"
- "مبيعات", "sales", "أوردر", "order" → "Sales Revenue"
- If nothing matches → "Other"

### Payment Method Mapping
- "كاش", "cash", "نقدي" → "CASH"
- "كارت", "card", "فيزا", "visa" → "CARD"
- "إنستاباي", "instapay" → "INSTAPAY"
- "كاش أون ديليفري", "cod", "تحصيل" → "COD"
- Default → "CASH"

### Date Mapping
- "النهاردة", "today", "اليوم" → ${currentDate}
- "إمبارح", "امبارح", "yesterday" → ${yesterdayDate}
- Otherwise default to ${currentDate}.

### Type Inference
- Buying, paying, spending, expenses, "دفعت", "اشتريت", "صرفت", "فاتورة" → "EXPENSE"
- Receiving money, sales, income, orders, "دخل", "قبضت", "بعت" → "INCOME"
- Default → "EXPENSE"

Return ONLY the JSON object. No explanation, no markdown.`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: transcript },
      ],
      temperature: 0.1, // low temperature = more deterministic JSON
    });

    const text = completion.choices[0]?.message?.content ?? "";
    const parsed: ParsedTransaction = JSON.parse(text);

    // ── Validation & sanitization ────────────────────────────────────────────
    if (!parsed.amount || typeof parsed.amount !== "number" || parsed.amount <= 0) {
      return { success: false, error: "Could not extract a valid amount from your voice. Please try again." };
    }

    if (!["INCOME", "EXPENSE"].includes(parsed.type)) {
      parsed.type = "EXPENSE";
    }

    if (!["CASH", "CARD", "COD", "INSTAPAY"].includes(parsed.paymentMethod)) {
      parsed.paymentMethod = "CASH";
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) {
      parsed.date = currentDate;
    }

    console.log("✅ [GROQ] Pipeline complete:", parsed);
    return { success: true, data: parsed };

  } catch (error: any) {
    console.error("Groq Pipeline Error:", error);

    // Detect rate-limit / quota errors (HTTP 429)
    const isRateLimit =
      error?.status === 429 ||
      error?.message?.toLowerCase().includes("rate") ||
      error?.message?.toLowerCase().includes("quota") ||
      error?.message?.toLowerCase().includes("too many");

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

export interface ParsedReceipt {
  amount: number | null;
  merchant: string | null;
  date: string | null;
  category: string | null;
  notes: string | null;
  imageUrl: string;
}

export async function parseReceiptFromImage(imageUrl: string): Promise<ParsedReceipt | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error("GROQ_API_KEY is not configured.");
    return null;
  }

  const groq = new Groq({ apiKey });

  const messages = [
    {
      role: "user",
      content: [
        { type: "text", text: "You extract structured data from Egyptian receipts and Instapay screenshots. Rules: Return ONLY a valid JSON object. Do not include explanations, markdown formatting, or extra text. If a field is missing or illegible, return null. Fields: amount: total paid (number, strip all currency symbols like EGP or USD. Prefer final total amount). merchant: business name (string, translate Arabic names to English context if possible). date: format YYYY-MM-DD (string, infer from context if needed, else null). category: choose ONLY from [Ads, Materials, Shipping, Salary, Software, Operations, Other]. notes: short optional context (string or null). Output format: { \"amount\": number|null, \"merchant\": string|null, \"date\": string|null, \"category\": string|null, \"notes\": string|null }" },
        { type: "image_url", image_url: { url: imageUrl } }
      ]
    }
  ];

  try {
    let text = "";
    try {
      const completion = await groq.chat.completions.create({
        model: "llama-3.2-90b-vision-preview",
        response_format: { type: "json_object" },
        messages: messages as any,
      });
      text = completion.choices[0]?.message?.content ?? "";
    } catch (err: any) {
      console.warn("Groq JSON mode failed, retrying without response_format", err.message);
      const completion = await groq.chat.completions.create({
        model: "llama-3.2-90b-vision-preview",
        messages: messages as any,
      });
      text = completion.choices[0]?.message?.content ?? "";
    }

    text = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(text);

    return {
      amount: parsed.amount ?? null,
      merchant: parsed.merchant ?? null,
      date: parsed.date ?? null,
      category: parsed.category ?? null,
      notes: parsed.notes ?? null,
      imageUrl,
    };
  } catch (error) {
    console.error("parseReceiptFromImage failed:", error);
    return null;
  }
}

