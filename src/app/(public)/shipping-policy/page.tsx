import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Shipping & Delivery Service Duration | Margin",
}

export default function ShippingPolicy() {
  return (
    <>
      <main className="flex-1 w-full max-w-3xl mx-auto py-16 px-4 md:px-8">
        <h1 className="text-3xl font-bold text-zinc-900 mb-8">Shipping &amp; Delivery Service Duration</h1>
        
        <div className="space-y-6 text-zinc-600 leading-relaxed">
          <h2 className="text-xl font-semibold text-zinc-900 mt-8 mb-4">Delivery of Digital Services:</h2>
          <p>
            Margin is a cloud-based Software-as-a-Service (SaaS) platform. We do not sell physical goods; therefore, there is no physical shipping or handling involved.
          </p>
          
          <h2 className="text-xl font-semibold text-zinc-900 mt-8 mb-4">Service Duration &amp; Activation:</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Account Activation:</strong> Upon successful payment of your subscription plan via PayMob, access to your Margin dashboard, including your allotted AI limits and integration capabilities, is delivered instantly and automatically to your account.</li>
            <li><strong>Billing Cycles:</strong> Services are delivered continuously for the duration of your active subscription cycle (monthly or annually).</li>
          </ul>

          <p className="mt-8">
            If you experience any delay in your account upgrading after a successful payment, please contact our support team immediately.
          </p>
        </div>
      </main>
    </>
  )
}
