import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { refreshBostaToken } from "@/actions/bosta.actions";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // You can hardcode these values here or pass them in the URL
    // e.g., http://localhost:3000/api/test-bosta?trackingNumber=12345&orgId=cl...
    const trackingNumber = searchParams.get("trackingNumber") || "HARDCODED_TRACKING_NUMBER"; 
    const orgId = searchParams.get("orgId") || "HARDCODED_ORG_ID"; 

    if (trackingNumber === "HARDCODED_TRACKING_NUMBER" || orgId === "HARDCODED_ORG_ID") {
        return NextResponse.json({ 
            error: "Please provide trackingNumber and orgId query parameters, or hardcode them directly in src/app/api/test-bosta/route.ts." 
        }, { status: 400 });
    }

    // Get a fresh token using Margin's existing utility
    const freshToken = await refreshBostaToken(orgId);

    // Fetch the delivery details from Bosta
    const response = await fetch(`https://app.bosta.co/api/v2/deliveries/business/${trackingNumber}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${freshToken}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    // Log the ENTIRE raw JSON response to the server console
    console.log("\n=== BOSTA RAW PAYLOAD PROBE ===");
    console.log(JSON.stringify(data, null, 2));
    console.log("===============================\n");

    return NextResponse.json({ 
      success: true, 
      message: "Check your server console for the raw JSON payload",
      data 
    });
  } catch (error: any) {
    console.error("Bosta Probe Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
