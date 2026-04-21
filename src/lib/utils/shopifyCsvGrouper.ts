export function groupShopifyRows(rows: Record<string, string>[]): unknown[] {
  const grouped = rows.reduce((acc, row) => {
    let nameStr = row["Name"];
    if (!nameStr) return acc;
    
    nameStr = nameStr.replace(/^#/, "").trim().toLowerCase();

    if (!acc[nameStr]) {
      const finStatus = row["Financial Status"]?.trim().toLowerCase() || "";
      const paymentMethod = finStatus === "paid" ? "CARD" : "COD";

      acc[nameStr] = {
        shopifyOrderId: nameStr,
        // Using "Total" for amount and "Created at" for date based on Shopify CSV format
        amount: row["Total"]?.trim() || "0", 
        date: row["Created at"]?.trim() || "",
        paymentMethod,
        lineItems: []
      };
    }

    // Every row can have a line item
    const lineItemName = row["Lineitem name"]?.trim();
    if (lineItemName) {
      acc[nameStr].lineItems.push({
        name: lineItemName,
        quantity: row["Lineitem quantity"]?.trim() || "1",
        price: row["Lineitem price"]?.trim() || "0"
      });
    }

    return acc;
  }, {} as Record<string, any>);

  return Object.values(grouped);
}
