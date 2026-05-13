import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const test = searchParams.get("test");

    const integration = await prisma.bostaIntegration.findFirst();
    if (!integration) return NextResponse.json({ error: "No Bosta integration found" });

    const { token, refreshToken, organizationId } = integration;

    // --- 1. AUTH HEALTH CHECK (Is current session alive?) ---
    if (test === "health") {
      const res = await fetch("https://app.bosta.co/api/v2/users/me", {
        method: "GET",
        headers: { "Authorization": token }
      });
      return NextResponse.json({
        endpoint: "v2/users/me",
        status: res.status,
        is_alive: res.ok,
        message: res.ok ? "Token is currently valid" : "Token has expired"
      });
    }

    // --- 2. REFRESH ROTATION (Can we get new keys?) ---
    if (test === "refresh") {
      const res = await fetch("https://app.bosta.co/api/v2/users/refresh-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken })
      });
      const data = await res.json();
      const isValidSchema = !!(data.data?.token && data.data?.refreshToken);

      return NextResponse.json({
        endpoint: "v2 refresh",
        status: res.status,
        schema_verified: isValidSchema,
        tokens_received: isValidSchema ? "REDACTED_SUCCESS" : "MISSING_DATA"
      });
    }

    // --- 3. FINANCIAL ANALYTICS (Can we see the money?) ---
    if (test === "analytics") {
      const res = await fetch("https://app.bosta.co/api/v2/deliveries/analytics/total-deliveries", {
        method: "GET",
        headers: { "Authorization": token },
        cache: "no-store"
      });
      const data = await res.json();
      return NextResponse.json({
        endpoint: "v2 analytics",
        status: res.status,
        has_data: !!data.data,
        sample: data.data || null
      });
    }

    // --- 4. SYNC MATCHING (Does logic find #9999?) ---
    if (test === "sync_logic") {
      const bostaRes = await fetch("https://app.bosta.co/api/v0/deliveries?limit=50", {
        method: "GET",
        headers: { "Authorization": token },
        cache: "no-store"
      });
      const bostaData = await bostaRes.json();
      const deliveries = bostaData.deliveries || bostaData.data?.deliveries || [];

      const pending = await prisma.transaction.findMany({
        where: { organizationId, status: "PENDING" }
      });

      const audit = pending.map(t => {
        const expectedSuffix = `#${t.shopifyOrderId}`;
        const match = deliveries.find((d: any) =>
          d.businessReference && String(d.businessReference).endsWith(expectedSuffix)
        );
        return {
          target_order: expectedSuffix,
          match_found: !!match,
          bosta_tracking: match?.trackingNumber || null,
          bosta_state: match?.state?.value || null
        };
      });

      return NextResponse.json({
        bosta_records_scanned: deliveries.length,
        db_records_pending: pending.length,
        results: audit
      });
    }

    return NextResponse.json({
      message: "Bosta Forensic Suite Ready",
      endpoints: [
        "health",
        "refresh",
        "analytics",
        "sync_logic"
      ].map(t => `?test=${t}`)
    });

  } catch (error: any) {
    return NextResponse.json({ error: "Audit Crash", message: error.message });
  }
}