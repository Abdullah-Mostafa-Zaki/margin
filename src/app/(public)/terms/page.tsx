import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Terms and Conditions | Margin",
}

export default function TermsPage() {
  return (
    <>
      <main className="flex-1 w-full max-w-3xl mx-auto py-16 px-4 md:px-8">
        <h1 className="text-3xl font-bold text-zinc-900 mb-2">Terms and Conditions</h1>
        <p className="text-sm text-zinc-500 mb-8">Effective Date: 25/6/2026</p>
        
        <div className="space-y-6 text-zinc-600 leading-relaxed">
          <ol className="list-decimal pl-5 space-y-4">
            <li>
              <strong>Service Description:</strong> Margin is an AI-powered financial tracking and analytics platform for e-commerce brands.
            </li>
            <li>
              <strong>Acceptable Use:</strong> You agree to use Margin only for lawful business purposes. You must not attempt to reverse-engineer our AI parsing systems or exploit API limits.
            </li>
            <li>
              <strong>Third-Party Integrations:</strong> Margin integrates with third parties like Shopify and Bosta. We are not responsible for downtime, data inaccuracies, or policy changes originating from these external platforms.
            </li>
            <li>
              <strong>Payments &amp; Billing:</strong> By subscribing to a paid tier, you authorize us to charge your payment method on a recurring basis. Prices are listed in EGP and are subject to change with prior notice.
            </li>
            <li>
              <strong>Limitation of Liability:</strong> Margin provides financial analytics and AI-generated insights. These insights do not constitute certified legal or tax advice. You are solely responsible for the final verification of your financial records.
            </li>
          </ol>
        </div>
      </main>
    </>
  )
}
