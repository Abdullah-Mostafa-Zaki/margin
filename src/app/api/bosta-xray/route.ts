import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { refreshBostaToken } from "@/actions/bosta.actions";

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

    // --- 4. SYNC MATCHING (Dump the Raw Data) ---
    if (test === "sync_logic") {
      // 1. Force a refresh to ensure the token isn't expired
      const freshToken = await refreshBostaToken(organizationId);

      // 2. Ensure the token has the "Bearer " prefix for the v0 call
      const authHeader = freshToken.startsWith("Bearer ") ? freshToken : `Bearer ${freshToken}`;

      const bostaRes = await fetch("https://app.bosta.co/api/v0/deliveries?limit=50", {
        method: "GET",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/json"
        },
        cache: "no-store"
      });

      const bostaData = await bostaRes.json().catch(() => ({ error: "Failed to parse JSON" }));

      return NextResponse.json({
        debug: {
          using_email: integration.bostaEmail,
          using_orgId: organizationId,
          auth_header_used: authHeader.substring(0, 20) + "..."
        },
        raw_bosta_payload: bostaData
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