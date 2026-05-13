import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { refreshBostaToken } from "@/actions/bosta.actions";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Find the first available Bosta integration
    const integration = await prisma.bostaIntegration.findFirst({
      select: { organizationId: true }
    });

    if (!integration) {
      return NextResponse.json({ error: "No Bosta integration found in the database" }, { status: 404 });
    }

    // Get a fresh token
    const freshToken = await refreshBostaToken(integration.organizationId);

    // Fetch the recent deliveries with cache busting
    const response = await fetch("https://app.bosta.co/api/v0/deliveries?limit=5", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${freshToken}`,
        "Content-Type": "application/json"
      },
      cache: "no-store"
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Bosta API responded with status: ${response.status}`, statusText: response.statusText },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Return the raw payload directly
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Bosta Debug Route Error:", error);
    return NextResponse.json({ error: "Internal Server Error", message: error.message }, { status: 500 });
  }
}
