import { Metadata } from "next"

export const metadata: Metadata = {
  title: "About Us | Margin",
}

export default function AboutPage() {
  return (
    <>
      <main className="flex-1 w-full max-w-3xl mx-auto py-16 px-4 md:px-8">
        <h1 className="text-3xl font-bold text-zinc-900 mb-2">About Us</h1>
        <p className="text-lg font-medium text-zinc-800 mb-8">Margin: Your AI CFO.</p>
        
        <div className="space-y-6 text-zinc-600 leading-relaxed">
          <p>
            Margin is a hyper-localized, B2B financial operating system built specifically for Egyptian e-commerce brands, Shopify store owners, and Instagram sellers.
          </p>
          <p>
            We know that generic accounting tools don&apos;t understand the realities of the local market. That&apos;s why we built a platform that natively understands Egyptian Ammiya voice notes, instantly parses messy Instapay screenshots, and tracks your Cash on Delivery (COD) &quot;Ghost Revenue&quot; by syncing directly with local couriers like Bosta and your Shopify store.
          </p>
          <p>
            Our mission is simple: to completely eliminate manual data entry in Excel so brand owners can stop typing and start scaling.
          </p>
        </div>
      </main>
    </>
  )
}
