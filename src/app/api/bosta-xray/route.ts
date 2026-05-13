import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const test = searchParams.get("test");

    // 1. Let's see what we are actually pulling from the DB
    const integration = await prisma.bostaIntegration.findFirst();

    if (!integration) {
      return NextResponse.json({ error: "No Bosta integration found" });
    }

    // Masked data for security, but enough for you to verify
    const debugInfo = {
      orgId: integration.organizationId,
      email: integration.bostaEmail,
      tokenStart: integration.token.substring(0, 10) + "...",
      updatedAt: integration.updatedAt
    };

    if (!test) return NextResponse.json({ message: "Diagnostic Mode", dbRecord: debugInfo });

    const token = integration.token;
    let targetUrl = test === "analytics"
      ? "https://app.bosta.co/api/v0/deliveries/analytics/total-deliveries"
      : "https://app.bosta.co/api/v0/deliveries?limit=5";

    // TEST A: Standard Bearer
    const resA = await fetch(targetUrl, {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      cache: "no-store"
    });

    // TEST B: No "Bearer" prefix (common for Bosta v0)
    const resB = await fetch(targetUrl, {
      method: "GET",
      headers: { "Authorization": token, "Content-Type": "application/json" },
      cache: "no-store"
    });

    return NextResponse.json({
      db_record_used: debugInfo,
      test_results: {
        with_bearer: { status: resA.status, ok: resA.ok },
        no_bearer: { status: resB.status, ok: resB.ok }
      },
      raw_payload_if_success: resB.ok ? await resB.json() : (resA.ok ? await resA.json() : "Both failed")
    });

  } catch (error: any) {
    return NextResponse.json({ error: "Scanner Crash", message: error.message });
  }
}