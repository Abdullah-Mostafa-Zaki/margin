import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { refreshBostaToken } from "@/actions/bosta.actions";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const organizations = await prisma.organization.findMany({
      where: {
        bostaIntegration: {
          isNot: null,
        },
      },
      include: {
        bostaIntegration: true,
      },
    });

    let processedCount = 0;

    for (const org of organizations) {
      try {
        const freshToken = await refreshBostaToken(org.id);

        const pendingTransactions = await prisma.transaction.findMany({
          where: {
            organizationId: org.id,
            shopifyOrderId: { not: null },
            paymentMethod: "COD",
            OR: [
              { bostaState: null },
              { bostaState: "Pending" },
              { bostaState: "Pickup requested" },
              { bostaState: "In Transit" },
              { bostaState: "Out for delivery" },
            ]
          },
        });

        if (pendingTransactions.length === 0) continue;

        const pendingOrderIds = pendingTransactions.map((t) => t.shopifyOrderId).filter(Boolean) as string[];

        const searchResponse = await fetch("https://app.bosta.co/api/v2/deliveries/search", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${freshToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ businessReference: pendingOrderIds.join(",") }),
        });

        if (!searchResponse.ok) {
          console.error(`Failed to search Bosta deliveries for org ${org.id}`);
          continue;
        }

        const searchJson = await searchResponse.json();
        if (!searchJson.success || !searchJson.data) continue;

        let deliveries = [];
        if (Array.isArray(searchJson.data)) {
          deliveries = searchJson.data;
        } else if (searchJson.data.deliveries && Array.isArray(searchJson.data.deliveries)) {
          deliveries = searchJson.data.deliveries;
        } else {
          deliveries = [searchJson.data];
        }

        for (const delivery of deliveries) {
          if (!delivery || !delivery.businessReference) continue;

          const transaction = pendingTransactions.find(
            (t) => t.shopifyOrderId === delivery.businessReference || t.shopifyOrderId === String(delivery.businessReference)
          );

          if (!transaction) continue;

          const stateValue = delivery.state?.value?.toLowerCase() || "";
          
          if (stateValue.includes("delivered")) {
            const detailsResponse = await fetch(`https://app.bosta.co/api/v2/deliveries/business/${delivery.trackingNumber}`, {
              method: "GET",
              headers: {
                "Authorization": `Bearer ${freshToken}`,
                "Content-Type": "application/json",
              },
            });

            if (detailsResponse.ok) {
              const detailsJson = await detailsResponse.json();
              if (detailsJson.success && detailsJson.data) {
                const shipmentFees = detailsJson.data.shipmentFees || 0;
                
                await prisma.transaction.update({
                  where: { id: transaction.id },
                  data: {
                    bostaState: "Delivered",
                    bostaTrackingNumber: String(delivery.trackingNumber),
                    shipmentFee: shipmentFees,
                    bostaLastSyncedAt: new Date(),
                    status: "RECEIVED",
                  },
                });
                processedCount++;
              }
            }
          } else if (
            stateValue.includes("return") || 
            stateValue.includes("rto") || 
            stateValue.includes("cancel") || 
            stateValue.includes("unreachable")
          ) {
            await prisma.transaction.update({
              where: { id: transaction.id },
              data: {
                bostaState: "Returned",
                bostaTrackingNumber: String(delivery.trackingNumber),
                bostaLastSyncedAt: new Date(),
              },
            });
            processedCount++;
          }
        }
      } catch (orgError) {
        console.error(`Error processing org ${org.id} in Bosta sync:`, orgError);
      }
    }

    return NextResponse.json({ success: true, processedCount });
  } catch (error) {
    console.error("Bosta sync cron error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
