import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { hasRemainingQuota } from "@/lib/plans";
import Groq from "groq-sdk";

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

    // Check quota
    if (!hasRemainingQuota(org)) {
      return NextResponse.json({ error: "You've reached your monthly receipt scan limit. Please upgrade your plan." }, { status: 403 });
    }

    const body = await request.json();
    const { urls } = body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: "No image URLs provided" }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GROQ_API_KEY is not configured" }, { status: 500 });
    }
    const groq = new Groq({ apiKey });

    const allTransactions: any[] = [];

    // Process images in parallel
    const promises = urls.map(async (imageUrl: string) => {
      try {
        const messages = [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `You extract structured data from Egyptian receipts and Instapay screenshots. Rules:
1. Return ONLY a valid JSON object. Do not include explanations, markdown formatting, or extra text.
2. If a field is missing or illegible, return null. 
3. Determine if the transaction is INCOME or EXPENSE based on language cues:
   - "Transfer to", "sent", "paid" -> EXPENSE
   - "Received from", "payment in", "transfer from" -> INCOME
   Do NOT assume it is an expense.
4. "COD" is NEVER a valid paymentMethod for expenses.
5. Provide a confidence score ("high", "medium", "low"). Ambiguous rows should be marked medium or low.
6. Provide an optional short confidenceNote if medium or low.
7. Fields:
   amount: total paid (number, strip all currency symbols. Prefer final total amount).
   description: merchant or business name or brief description (string).
   date: format YYYY-MM-DD (string, infer from context if needed, else null).
   type: "INCOME" or "EXPENSE".
   category: MUST be exactly one of: "Sales Revenue", "Pop-up/Bazaar Sales", "Wholesale/B2B", "Supplier Refund", "Raw Materials", "Packaging", "Logistics (Shipping)", "Ads", "Content Creation", "Other". Default to "Other".
   paymentMethod: "CASH", "CARD", "INSTAPAY", "COD".
   confidence: "high" | "medium" | "low".
   confidenceNote: string | null.
   
Return a JSON object in exactly this format:
{
  "transactions": [
    {
      "amount": number|null,
      "description": string|null,
      "date": string|null,
      "type": "INCOME" | "EXPENSE",
      "category": string|null,
      "paymentMethod": "CASH" | "CARD" | "INSTAPAY" | "COD",
      "confidence": "high" | "medium" | "low",
      "confidenceNote": string|null
    }
  ]
}
If no transactions are found, return { "transactions": [] }. Never return a single object — always return the transactions array.`,
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
        
        if (!text) return [];

        const parsed = JSON.parse(text);

        if (!parsed.transactions || !Array.isArray(parsed.transactions)) {
          return [];
        }

        return parsed.transactions.map((t: any) => {
           let type = t.type === "INCOME" ? "INCOME" : "EXPENSE";
           let paymentMethod = ["CASH", "CARD", "INSTAPAY", "COD"].includes(t.paymentMethod) ? t.paymentMethod : "CASH";
           
           if (type === "EXPENSE" && paymentMethod === "COD") {
               paymentMethod = "CASH";
           }
           
           return {
             amount: typeof t.amount === "number" ? t.amount : 0,
             description: t.description || "Unknown",
             date: t.date || new Date().toISOString().split('T')[0],
             type,
             category: t.category || "Other",
             paymentMethod,
             confidence: ["high", "medium", "low"].includes(t.confidence) ? t.confidence : "medium",
             confidenceNote: t.confidenceNote || null,
             imageUrl
           };
        });
      } catch (err) {
        console.error("Image parsing failed for URL:", imageUrl, err);
        return [];
      }
    });

    const results = await Promise.all(promises);
    results.forEach(res => {
        allTransactions.push(...res);
    });

    // Increment telemetry counters
    if (urls.length > 0) {
      await prisma.organization.update({
        where: { id: org.id },
        data: {
          currentMonthReceipts: { increment: urls.length },
          currentMonthImage: { increment: urls.length },
        },
      });
    }

    return NextResponse.json({ transactions: allTransactions });

  } catch (error: any) {
    console.error("analyze-image error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
