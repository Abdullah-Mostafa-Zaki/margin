"use server";

import Groq from "groq-sdk";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { hasRemainingQuota } from "@/lib/plans";

async function getOrgFromSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { memberships: true },
  });

  const organizationId = user?.memberships[0]?.organizationId;
  if (!organizationId) throw new Error("Organization not found");

  return organizationId;
}

interface ParsedTransaction {
  amount: number;
  type: "INCOME" | "EXPENSE";
  category: string;
  paymentMethod: "CASH" | "CARD" | "COD" | "INSTAPAY";
  date: string;
  notes: string;
}

type VoiceActionResult =
  | { success: true; data: ParsedTransaction }
  | { success: false; error: string };

export async function parseVoiceTransaction(
  base64Audio: string,
  mimeType: string
): Promise<VoiceActionResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { success: false, error: "GROQ_API_KEY is not configured." };
  }

  if (!base64Audio || base64Audio.length < 100) {
    return { success: false, error: "Audio was too short or silent. Please speak clearly and try again." };
  }

  try {
    const organizationId = await getOrgFromSession();
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, plan: true, currentMonthVoice: true },
    });

    if (!org) throw new Error("Organization not found");
    if (!hasRemainingQuota(org.plan, 'voice', org.currentMonthVoice)) {
      throw new Error('QUOTA_EXCEEDED');
    }

    const groq = new Groq({ apiKey });

    let normalizedMime = mimeType;
    if (normalizedMime.includes("mp4")) normalizedMime = "audio/mp4";

    const extMap: Record<string, string> = {
      "audio/webm": "webm",
      "audio/mp4": "mp4",
      "audio/mpeg": "mp3",
      "audio/ogg": "ogg",
      "audio/wav": "wav",
      "audio/flac": "flac",
      "audio/m4a": "m4a",
    };
    const ext = extMap[normalizedMime] ?? "webm";
    const filename = `audio.${ext}`;

    console.log("🎙️ [GROQ] Phase 1 — Whisper transcription starting");

    const audioBuffer = Buffer.from(base64Audio, "base64");
    const audioFile = new File([audioBuffer], filename, { type: normalizedMime });

    const transcription = await groq.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-large-v3",
      language: "ar",
      prompt: "جنيه مصري، قماش، خامات، إعلانات، شحن، إنستاباي، كاش، مبيعات، أوردر، اشتريت، دفعت، ألف، تالاف، خمسمية، سبعمية، تمنمية، تسعمية، مية، ميتين، تلتمية، أربعمية، عشر تالاف، جنيه، ads, meta, facebook, instagram, reels, boost, shipping, order, items, pieces, total, cash, card, instapay.",
      temperature: 0,
    });

    const transcript = transcription.text?.trim();
    console.log("✅ [GROQ] Transcript:", transcript);

    if (!transcript) {
      return { success: false, error: "Could not transcribe audio. Please speak clearly and try again." };
    }

    const today = new Date();
    const currentDate = today.toLocaleDateString("en-CA");

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDate = yesterday.toLocaleDateString("en-CA");

    console.log("🧠 [GROQ] Phase 2 — Llama extraction starting");

    const systemPrompt = `You are a financial assistant for an Egyptian clothing brand owner. Today's date is ${currentDate}. Yesterday's date is ${yesterdayDate}.

The user speaks in Egyptian Arabic (Ammiya) or a mix of Arabic and English mid-sentence. Extract transaction details and return ONLY a valid JSON object:

{
  "amount": number,
  "type": "INCOME" | "EXPENSE",
  "category": string,
  "paymentMethod": "CASH" | "CARD" | "COD" | "INSTAPAY",
  "date": "YYYY-MM-DD",
  "notes": string
}

### Hundreds (Critical)
- "مية", "مئة" → 100
- "ميتين", "مئتين" → 200
- "تلتمية", "تلاتمية", "ثلاثمية" → 300
- "أربعمية", "اربعمية" → 400
- "خمسمية", "خومسوميت", "خمسمئة" → 500
- "ستمية", "ستمئة" → 600
- "سبعمية", "سبعمئة" → 700
- "تمنمية", "تمانمية", "ثمانمية" → 800
- "تسعمية", "تسعمئة" → 900

### Thousands (Critical)
- "ألف", "الف", "بألف" → 1000
- "ألفين", "الفين", "بألفين" → 2000
- "تالاف", "تلاف", "تلاتالاف", "بتلاتالاف", "ثلاثة آلاف" → 3000
- "أربع تالاف", "اربع تالاف", "أربعة آلاف" → 4000
- "خمس تالاف", "خمسة آلاف", "بخمستالاف", "بخمستلاف" → 5000
- "ست تالاف", "ستة آلاف" → 6000
- "سبع تالاف", "سبعة آلاف" → 7000
- "تمن تالاف", "تمانية آلاف", "ثمانية آلاف" → 8000
- "تسع تالاف", "تسعة آلاف" → 9000
- "عشر تالاف", "عشرة آلاف", "عشرتالاف" → 10000
- Strip any leading 'ب' prefix (e.g., "بخمستالاف" → 5000)

### Compound Numbers (Critical)
Combine hundreds and thousands correctly:
- "ألف وخمسمية", "الف وخومسوميت", "ألف و خمسمية" → 1500
- "ألفين وخمسمية" → 2500
- "تالاف وخمسمية" → 3500
- "ألف وميتين" → 1200
- "ألف وسبعمية" → 1700
- "خمسة آلاف وخمسمية" → 5500
Pattern: always add the components together.

### Whisper Mishear Corrections (Critical)
Whisper often mishears Egyptian Ammiya — intelligently correct:
- "وماشي", "وماش", "اماش", "أماش" → "قماش" (fabric/raw materials)
- "كيني", "جني", "جنية", "كيني" → "جنيه" (Egyptian pounds, ignore Kenya)
- "تالاف", "تلاف" → thousands (not a word, it means آلاف)
- "خومسوميت", "خومسميت" → "خمسمية" (500)
- "عشرتالاف", "عشرة تالاف" → 10000

### Mixed Arabic-English (Critical)
Users frequently mix Arabic and English mid-sentence. Handle these naturally:
- "لل ads", "على الads", "للإعلانات" → category: Ads
- "لل boost", "عملت boost" → category: Ads
- "لل shipping", "شحن" → category: Logistics (Shipping)
- "لل content", "كونتنت" → category: Content Creation
- "لل packaging", "تغليف" → category: Packaging
- English amount words: "one thousand", "five hundred" → treat as numbers

### Category Mapping
- "قماش", "أماش", "raw materials", "خامات", "أقمشة" → "Raw Materials"
- "تصنيع", "manufacturing", "مصنع", "تقفيل" → "Manufacturing"
- "تغليف", "packaging", "باكدجينج", "أكياس", "علب" → "Packaging"
- "شحن", "logistics", "shipping", "مندوب", "توصيل" → "Logistics (Shipping)"
- "إعلانات", "ads", "فيسبوك", "ميتا", "meta", "ممولة", "boost", "reels" → "Ads"
- "كونتنت", "content", "تصوير", "سيشن", "موديل" → "Content Creation"
- "مبيعات", "sales", "أوردر", "order" → "Sales Revenue"
- Default → "Other"

### Payment Method
- "كاش", "cash", "نقدي" → "CASH"
- "كارت", "card", "فيزا", "visa" → "CARD"
- "إنستاباي", "instapay" → "INSTAPAY"
- "كاش أون ديليفري", "cod", "تحصيل" → "COD"
- Default → "CASH"

### Date
- "النهاردة", "today", "اليوم" → ${currentDate}
- "إمبارح", "امبارح", "yesterday" → ${yesterdayDate}
- Default → ${currentDate}

### Transaction Type
- "دفعت", "اشتريت", "صرفت", "فاتورة", "paid", "bought", "spent" → "EXPENSE"
- "دخل", "قبضت", "بعت", "received", "sold", "order came in" → "INCOME"
- Default → "EXPENSE"

Return ONLY the JSON object. No explanation, no markdown.`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: transcript },
      ],
      temperature: 0.1,
    });

    const text = completion.choices[0]?.message?.content ?? "";
    const parsed: ParsedTransaction = JSON.parse(text);

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

    await prisma.organization.update({
      where: { id: org.id },
      data: { currentMonthVoice: { increment: 1 } },
    });

    return { success: true, data: parsed };

  } catch (error: any) {
    if (error?.message === 'QUOTA_EXCEEDED') {
      return { success: false, error: "You've reached your monthly voice note limit. Please upgrade your plan." };
    }

    console.error("Groq Pipeline Error:", error);

    const isRateLimit =
      error?.status === 429 ||
      error?.message?.toLowerCase().includes("rate") ||
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

export async function parseReceiptFromImage(imageUrl: string): Promise<ParsedReceipt[] | null> {
  console.log("AI received URL:", imageUrl);

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error("GROQ_API_KEY is not configured.");
    return null;
  }

  try {
    const groq = new Groq({ apiKey });

    const organizationId = await getOrgFromSession();
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, plan: true, currentMonthReceipts: true },
    });

    if (!org) throw new Error("Organization not found");
    if (!hasRemainingQuota(org.plan, 'receipts', org.currentMonthReceipts)) {
      throw new Error('QUOTA_EXCEEDED');
    }

    const messages = [
      {
        role: "user",
        content: [
          { type: "text", text: "You extract structured data from Egyptian receipts and Instapay screenshots. Rules: Return ONLY a valid JSON object. Do not include explanations, markdown formatting, or extra text. If a field is missing or illegible, return null. Fields: amount: total paid (number, strip all currency symbols like EGP or USD. Prefer final total amount). merchant: business name (string, translate Arabic names to English context if possible). date: format YYYY-MM-DD (string, infer from context if needed, else null). For the 'category' field, you MUST choose exactly one of the following exact strings: \"Raw Materials\", \"Manufacturing\", \"Packaging\", \"Logistics (Shipping)\", \"Ads\", \"Content Creation\", or \"Other\". Do not invent new categories. If the expense does not clearly fit into the first six, you must default to \"Other\". notes: short optional context (string or null). Identify every distinct transaction, line item, or expense visible in this image. Return a JSON object in exactly this format: { \"transactions\": [ { \"amount\": number|null, \"merchant\": string|null, \"date\": string|null, \"category\": string|null, \"notes\": string|null } ] }. If no transactions are found, return { \"transactions\": [] }. Never return a single object — always return the transactions array." },
          { type: "image_url", image_url: { url: imageUrl } }
        ]
      }
    ];

    let text = "";
    try {
      const completion = await groq.chat.completions.create({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        response_format: { type: "json_object" },
        messages: messages as any,
      });
      text = completion.choices[0]?.message?.content ?? "";
    } catch (err: any) {
      console.warn("Groq JSON mode failed, retrying without response_format", err.message);
      const completion = await groq.chat.completions.create({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: messages as any,
      });
      text = completion.choices[0]?.message?.content ?? "";
    }

    text = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    console.log("Groq Response:", text);

    if (!text) {
      throw new Error("Groq returned empty response");
    }

    const parsed = JSON.parse(text);

    await prisma.organization.update({
      where: { id: org.id },
      data: { currentMonthReceipts: { increment: 1 } },
    });

    const VALID_CATEGORIES = ["Raw Materials", "Manufacturing", "Packaging", "Logistics (Shipping)", "Ads", "Content Creation", "Other"] as const;

    if (!parsed.transactions || !Array.isArray(parsed.transactions)) {
      if (parsed.amount !== undefined) {
        return [{
          amount: parsed.amount ?? null,
          merchant: parsed.merchant ?? null,
          date: parsed.date ?? null,
          category: VALID_CATEGORIES.includes(parsed.category as any) ? parsed.category : "Other",
          notes: parsed.notes ?? null,
          imageUrl,
        }];
      }
      return [];
    }

    const transactions: ParsedReceipt[] = parsed.transactions.map((t: Omit<ParsedReceipt, "imageUrl">) => ({
      amount: t.amount ?? null,
      merchant: t.merchant ?? null,
      date: t.date ?? null,
      category: VALID_CATEGORIES.includes(t.category as any) ? t.category : "Other",
      notes: t.notes ?? null,
      imageUrl,
    }));

    return transactions;
  } catch (error: any) {
    if (error?.message === 'QUOTA_EXCEEDED') {
      throw error;
    }
    console.error("Groq Vision API Error:", error);
    return null;
  }
}