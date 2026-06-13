"use server";

import Groq from "groq-sdk";
import { createClient as createDeepgramClient } from "@deepgram/sdk";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { hasRemainingQuota } from "@/lib/plans";

// ─────────────────────────────────────────────────────────────────────────────
// Shared Types
// ─────────────────────────────────────────────────────────────────────────────

interface ParsedTransaction {
  amount: number;
  type: "INCOME" | "EXPENSE";
  category: string;
  paymentMethod: "CASH" | "CARD" | "COD" | "INSTAPAY";
  date: string;
  notes: string;
}

type ActionResult =
  | { success: true; data: ParsedTransaction }
  | { success: false; error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Private Helper — Auth + Org Lookup
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Private Helper — Straightjacket System Prompt
// ─────────────────────────────────────────────────────────────────────────────

function buildSystemPrompt(currentDate: string, yesterdayDate: string): string {
  return `You are a strict financial data extractor for an Egyptian clothing brand owner.
Today is ${currentDate}. Yesterday was ${yesterdayDate}.

The user speaks Egyptian Arabic (Ammiya), English, or a mix of both mid-sentence.
Your ONLY job is to extract transaction data and return a single, valid JSON object.
Return NOTHING else — no explanation, no markdown, no commentary.

## OUTPUT SCHEMA
{
  "amount": number,
  "type": "INCOME" | "EXPENSE",
  "category": string,
  "paymentMethod": "CASH" | "CARD" | "COD" | "INSTAPAY",
  "date": "YYYY-MM-DD",
  "notes": string
}

## CATEGORY ENUM (use EXACTLY one of these strings)
- "Raw Materials"         → قماش، خامات، أقمشة، raw materials، أماش، وماشي
- "Manufacturing"         → تصنيع، مصنع، تقفيل، manufacturing
- "Packaging"             → تغليف، أكياس، علب، packaging، باكدجينج
- "Logistics (Shipping)"  → شحن، توصيل، مندوب، logistics، shipping
- "Ads"                   → إعلانات، ميتا، meta، facebook، فيسبوك، Instagram، boost، reels، ممولة
- "Content Creation"      → كونتنت، تصوير، سيشن، موديل، content
- "Facilities"         → إيجار، كهرباء، مياه، فواتير، facilities، مكان
- "Subscriptions"      → اشتراك، سوفتوير، تطبيق، subscriptions، software، SaaS
- "Salaries"           → مرتب، راتب، أجر، موظف، salaries، عمالة
- "Taxes & Legal"      → ضرايب، ضرائب، محامي، قانوني، taxes، legal، حكومة
- "Returns & Refunds"  → مرتجع، استرداد، رجع فلوس، returns، refunds، استرجاع
- "Sales Revenue"         → مبيعات، بيع، أوردر، order، sales، قبضت، بعت
- "Other"                 → anything else

## NUMBER PARSING — Egyptian Ammiya (CRITICAL)

### Hundreds
مية / مئة → 100 | ميتين → 200 | تلتمية / تلاتمية → 300
أربعمية → 400 | خمسمية / خومسوميت → 500 | ستمية → 600
سبعمية → 700 | تمنمية / تمانمية → 800 | تسعمية → 900

### Thousands
ألف / الف → 1000 | ألفين / الفين → 2000
تالاف / تلاف / تلاتالاف → 3000 | أربع تالاف → 4000
خمس تالاف / بخمستالاف → 5000 | ست تالاف → 6000
سبع تالاف → 7000 | تمن تالاف → 8000 | تسع تالاف → 9000
عشر تالاف / عشرتالاف → 10000
Strip leading "ب" prefix: بخمستالاف → 5000

### Compound Numbers — always ADD the components
alf w nos / ألف ونص / ألف وخمسمية → 1500
telt talaf / تلت تالاف / تلاتالاف → 3000
miyya w khamseen / مية وخمسين → 150
ألفين وخمسمية → 2500
خمسة آلاف وخمسمية → 5500

### Whisper Mishear Corrections
وماشي / اماش / أماش → قماش (fabric)
كيني / جني / جنية → جنيه (EGP, not Kenya)
تالاف / تلاف → thousands
خومسوميت / خومسميت → خمسمية = 500

## FEW-SHOT EXAMPLES

Input: "دفعت ألف وخمسمية على الads كاش"
Output: {"amount":1500,"type":"EXPENSE","category":"Ads","paymentMethod":"CASH","date":"${currentDate}","notes":"Paid 1500 EGP for ads"}

Input: "اشتريت telt talaf قماش انستاباي"
Output: {"amount":3000,"type":"EXPENSE","category":"Raw Materials","paymentMethod":"INSTAPAY","date":"${currentDate}","notes":"Fabric 3000 EGP via Instapay"}

Input: "جه أوردر miyya w khamseen كاش أون ديليفري"
Output: {"amount":150,"type":"INCOME","category":"Sales Revenue","paymentMethod":"COD","date":"${currentDate}","notes":"COD order 150 EGP"}

Input: "paid 2000 for Meta ads yesterday"
Output: {"amount":2000,"type":"EXPENSE","category":"Ads","paymentMethod":"CASH","date":"${yesterdayDate}","notes":"Meta ads 2000 EGP"}

Input: "شحن بخمستالاف انستاباي امبارح"
Output: {"amount":5000,"type":"EXPENSE","category":"Logistics (Shipping)","paymentMethod":"INSTAPAY","date":"${yesterdayDate}","notes":"Shipping 5000 EGP via Instapay"}

Input: "Facebook boost ب telt talaf"
Output: {"amount":3000,"type":"EXPENSE","category":"Ads","paymentMethod":"CASH","date":"${currentDate}","notes":"Facebook boost 3000 EGP"}

## PAYMENT METHOD
كاش / cash / نقدي → "CASH"
كارت / card / فيزا / visa → "CARD"
إنستاباي / instapay / انستاباي → "INSTAPAY"
كاش أون ديليفري / cod / تحصيل → "COD"
Default → "CASH"

## AMOUNT — CRITICAL RULE
If the user does NOT explicitly mention a price, number, or monetary value, output "amount": 0.
Do NOT guess, estimate, or infer a price from the product name. Only extract a number if it is literally stated in the input.
Example: "ana eshtaret omash" → amount: 0 (no price mentioned)
Example: "eshtaret omash be 350" → amount: 350

## DATE
النهاردة / today / اليوم → ${currentDate}
إمبارح / امبارح / yesterday → ${yesterdayDate}
Default → ${currentDate}

## TRANSACTION TYPE
دفعت / اشتريت / صرفت / paid / bought / spent → "EXPENSE"
دخل / قبضت / بعت / جه أوردر / received / sold → "INCOME"
Default → "EXPENSE"

Return ONLY the JSON object. No explanation. No markdown.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Private Helper — Shared LLM Inference Engine (Groq Llama-3.3-70B)
// ─────────────────────────────────────────────────────────────────────────────

async function extractTransactionFromText(
  transcript: string
): Promise<{ success: boolean; data?: ParsedTransaction; error?: string }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { success: false, error: "GROQ_API_KEY is not configured." };
  }

  const today = new Date();
  const currentDate = today.toLocaleDateString("en-CA");
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayDate = yesterday.toLocaleDateString("en-CA");

  try {
    const groq = new Groq({ apiKey });

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildSystemPrompt(currentDate, yesterdayDate) },
        { role: "user", content: transcript },
      ],
      temperature: 0.1,
      max_tokens: 256,
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    if (!raw) {
      return { success: false, error: "Groq returned an empty response. Please try again." };
    }

    const parsed: ParsedTransaction = JSON.parse(raw);
    
    // Normalize missing or invalid amount to 0 so the frontend can highlight it
    if (!parsed.amount || typeof parsed.amount !== "number" || parsed.amount < 0) {
      parsed.amount = 0;
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

    if (typeof parsed.notes !== "string") {
      parsed.notes = "";
    } else {
      parsed.notes = parsed.notes.slice(0, 60);
    }

    return { success: true, data: parsed };
  } catch (error: any) {
    console.error("🔴 [extractTransactionFromText] Groq inference error:", error);

    const isRateLimit =
      error?.status === 429 ||
      error?.message?.toLowerCase().includes("rate") ||
      error?.message?.toLowerCase().includes("too many");

    if (isRateLimit) {
      return {
        success: false,
        error: "AI service is rate-limited. Please wait a moment and try again.",
      };
    }

    return {
      success: false,
      error: error?.message || "AI extraction failed. Please try again.",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC — Text Transaction Action
// ─────────────────────────────────────────────────────────────────────────────

export async function parseTextTransaction(text: string): Promise<ActionResult> {
  if (!text?.trim()) {
    return { success: false, error: "Input text is empty." };
  }

  try {
    const organizationId = await getOrgFromSession();
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, plan: true, currentMonthVoice: true, currentMonthImage: true, currentMonthText: true },
    });

    if (!org) throw new Error("Organization not found");

    if (!hasRemainingQuota(org)) {
      return {
        success: false,
        error: "You've reached your monthly text parsing limit. Please upgrade your plan.",
      };
    }

    console.log("🧠 [TEXT] Routing to Groq Llama-3.3-70B:", text.slice(0, 80));

    const result = await extractTransactionFromText(text.trim());

    if (!result.success || !result.data) {
      return { success: false, error: result.error ?? "Extraction failed." };
    }

    // Increment telemetry counter
    await prisma.organization.update({
      where: { id: org.id },
      data: { currentMonthText: { increment: 1 } },
    });

    console.log("✅ [TEXT] Extraction complete:", result.data);
    return { success: true, data: result.data };
  } catch (error: any) {
    console.error("🔴 [parseTextTransaction] Error:", error);
    return {
      success: false,
      error: error?.message || "Text processing failed. Please try again.",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC — Voice Transaction Action (Deepgram Nova-3 → Groq Llama-3.3-70B)
// ─────────────────────────────────────────────────────────────────────────────

export async function parseVoiceTransaction(
  base64Audio: string,
  mimeType: string
): Promise<ActionResult> {
  const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
  if (!deepgramApiKey) {
    return { success: false, error: "DEEPGRAM_API_KEY is not configured." };
  }

  if (!base64Audio || base64Audio.length < 100) {
    return {
      success: false,
      error: "Audio was too short or silent. Please speak clearly and try again.",
    };
  }

  try {
    const organizationId = await getOrgFromSession();
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, plan: true, currentMonthVoice: true, currentMonthImage: true, currentMonthText: true },
    });

    if (!org) throw new Error("Organization not found");

    if (!hasRemainingQuota(org)) {
      return {
        success: false,
        error: "You've reached your monthly voice note limit. Please upgrade your plan.",
      };
    }

    // ── Phase 1: Deepgram Nova-3 STT ────────────────────────────────────────
    console.log("🎙️ [VOICE] Phase 1 — Deepgram Nova-3 transcription starting");

    const audioBuffer = Buffer.from(base64Audio, "base64");
    const deepgram = createDeepgramClient(deepgramApiKey);

    const { result: dgResult, error: dgError } =
      await deepgram.listen.prerecorded.transcribeFile(audioBuffer, {
        model: "nova-3",
        language: "ar",
        smart_format: true,
        punctuate: true,
      });

    if (dgError) {
      console.error("🔴 [VOICE] Deepgram error:", dgError);
      return {
        success: false,
        error: "Voice transcription failed. Please speak clearly and try again.",
      };
    }

    const transcript =
      dgResult?.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ?? "";

    console.log("✅ [VOICE] Deepgram transcript:", transcript);

    if (!transcript) {
      return {
        success: false,
        error: "Could not transcribe audio. Please speak clearly and try again.",
      };
    }

    // ── Phase 2: Groq Llama-3.3-70B Extraction ──────────────────────────────
    console.log("🧠 [VOICE] Phase 2 — Groq Llama-3.3-70B extraction starting");

    const result = await extractTransactionFromText(transcript);

    if (!result.success || !result.data) {
      return { success: false, error: result.error ?? "Extraction failed." };
    }

    // Increment telemetry counter
    await prisma.organization.update({
      where: { id: org.id },
      data: { currentMonthVoice: { increment: 1 } },
    });

    console.log("✅ [VOICE] Pipeline complete:", result.data);
    return { success: true, data: result.data };
  } catch (error: any) {
    if (error?.message === "QUOTA_EXCEEDED") {
      return {
        success: false,
        error: "You've reached your monthly voice note limit. Please upgrade your plan.",
      };
    }

    console.error("🔴 [parseVoiceTransaction] Error:", error);

    const isRateLimit =
      error?.status === 429 ||
      error?.message?.toLowerCase().includes("rate") ||
      error?.message?.toLowerCase().includes("too many");

    if (isRateLimit) {
      return {
        success: false,
        error: "AI service is currently rate-limited. Please wait a moment and try again.",
      };
    }

    return {
      success: false,
      error: error?.message || "Voice processing failed. Please try again.",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared Receipt Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedReceipt {
  amount: number | null;
  merchant: string | null;
  date: string | null;
  category: string | null;
  notes: string | null;
  imageUrl: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC — Image Receipt Parsing (Groq Vision → currentMonthImage telemetry)
// ─────────────────────────────────────────────────────────────────────────────

export async function parseReceiptFromImage(imageUrl: string): Promise<ParsedReceipt[] | null> {
  console.log("🖼️ [IMAGE] AI received URL:", imageUrl);

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
      select: { id: true, plan: true, currentMonthVoice: true, currentMonthImage: true, currentMonthText: true },
    });

    if (!org) throw new Error("Organization not found");

    if (!hasRemainingQuota(org)) {
      throw new Error("QUOTA_EXCEEDED");
    }

    const messages = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `You extract structured data from Egyptian receipts and Instapay screenshots. Rules: Return ONLY a valid JSON object. Do not include explanations, markdown formatting, or extra text. If a field is missing or illegible, return null. Fields: amount: total paid (number, strip all currency symbols like EGP or USD. Prefer final total amount). merchant: business name (string, translate Arabic names to English context if possible). date: format YYYY-MM-DD (string, infer from context if needed, else null). For the 'category' field, you MUST choose exactly one of the following exact strings: "Raw Materials", "Manufacturing", "Packaging", "Logistics (Shipping)", "Ads", "Content Creation", "Facilities", "Subscriptions", "Salaries", "Taxes & Legal", "Returns & Refunds", or "Other". Do not invent new categories. If the expense does not clearly fit into the first eleven, you must default to "Other". notes: short optional context (string or null). Identify every distinct transaction, line item, or expense visible in this image. Return a JSON object in exactly this format: { "transactions": [ { "amount": number|null, "merchant": string|null, "date": string|null, "category": string|null, "notes": string|null } ] }. If no transactions are found, return { "transactions": [] }. Never return a single object — always return the transactions array.`,
          },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
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
      console.warn("🟡 [IMAGE] Groq JSON mode failed, retrying without response_format:", err.message);
      const completion = await groq.chat.completions.create({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: messages as any,
      });
      text = completion.choices[0]?.message?.content ?? "";
    }

    text = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    console.log("✅ [IMAGE] Groq Vision response:", text);

    if (!text) throw new Error("Groq returned empty response");

    const parsed = JSON.parse(text);

    // ── Increment image telemetry counter ────────────────────────────────────
    await prisma.organization.update({
      where: { id: org.id },
      data: {
        currentMonthReceipts: { increment: 1 },
        currentMonthImage: { increment: 1 },
      },
    });

    const VALID_CATEGORIES = [
      "Raw Materials",
      "Manufacturing",
      "Packaging",
      "Logistics (Shipping)",
      "Ads",
      "Content Creation",
      "Facilities",
      "Subscriptions",
      "Salaries",
      "Taxes & Legal",
      "Returns & Refunds",
      "Other",
    ] as const;

    if (!parsed.transactions || !Array.isArray(parsed.transactions)) {
      if (parsed.amount !== undefined) {
        return [
          {
            amount: parsed.amount ?? null,
            merchant: parsed.merchant ?? null,
            date: parsed.date ?? null,
            category: VALID_CATEGORIES.includes(parsed.category as any)
              ? parsed.category
              : "Other",
            notes: parsed.notes ?? null,
            imageUrl,
          },
        ];
      }
      return [];
    }

    const transactions: ParsedReceipt[] = parsed.transactions.map(
      (t: Omit<ParsedReceipt, "imageUrl">) => ({
        amount: t.amount ?? null,
        merchant: t.merchant ?? null,
        date: t.date ?? null,
        category: VALID_CATEGORIES.includes(t.category as any) ? t.category : "Other",
        notes: t.notes ?? null,
        imageUrl,
      })
    );

    return transactions;
  } catch (error: any) {
    if (error?.message === "QUOTA_EXCEEDED") {
      throw error;
    }
    console.error("🔴 [IMAGE] Groq Vision API Error:", error);
    return null;
  }
}