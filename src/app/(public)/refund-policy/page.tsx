import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy | Margin",
}

export default function RefundPolicy() {
  return (
    <>
      <main className="flex-1 w-full max-w-3xl mx-auto py-16 px-4 md:px-8">
        <h1 className="text-3xl font-bold text-zinc-900 mb-2">Refund &amp; Cancellation Policy</h1>
        <p className="text-sm text-zinc-500 mb-8">Effective Date: 25/6/2026</p>
        
        <div className="space-y-6 text-zinc-600 leading-relaxed">
          <p>
            At Margin, we provide a digital Software-as-a-Service (SaaS) product. Because our service relies on real-time AI API usage and immediate access to analytics, our refund policy is as follows:
          </p>
          
          <h2 className="text-xl font-semibold text-zinc-900 mt-8 mb-4">Cancellations:</h2>
          <p>
            You may cancel your subscription at any time through your billing dashboard. Once canceled, you will retain access to your current tier&apos;s features until the end of your current billing cycle.
          </p>

          <h2 className="text-xl font-semibold text-zinc-900 mt-8 mb-4">Refunds:</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Monthly Subscriptions:</strong> We do not offer refunds for partial months of service or unused AI transaction limits.</li>
            <li><strong>Annual Subscriptions:</strong> If you are on an annual plan and are dissatisfied within the first 14 days of your purchase, please contact us for a prorated refund. After 14 days, annual subscriptions are non-refundable.</li>
            <li><strong>Failed Integrations:</strong> If technical issues on our end prevent you from syncing core integrations and our support team cannot resolve it, you may be eligible for a refund for that billing period.</li>
          </ul>

          <p className="mt-8">
            Contact: <a href="mailto:abdullah.mostafa.zaki@gmail.com" className="text-[#1aa772] hover:underline transition-colors">abdullah.mostafa.zaki@gmail.com</a>
          </p>
        </div>
      </main>
    </>
  )
}
