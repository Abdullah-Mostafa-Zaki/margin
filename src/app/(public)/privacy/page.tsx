import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Privacy Policy | Margin",
}

export default function PrivacyPolicy() {
  return (
    <>
      <main className="flex-1 w-full max-w-3xl mx-auto py-16 px-4 md:px-8">
        <h1 className="text-3xl font-bold text-zinc-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-zinc-500 mb-8">Effective Date: 25/6/2026</p>
        
        <div className="space-y-6 text-zinc-600 leading-relaxed">
          <p>
            Welcome to Margin ("we," "our," or "us"). We are committed to protecting your privacy and ensuring your data is secure. This Privacy Policy explains how we collect, use, and protect your information when you use our B2B financial operating system.
          </p>
          
          <h2 className="text-xl font-semibold text-zinc-900 mt-8 mb-4">Information We Collect:</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Account Information:</strong> Name, email address, company name, and payment details.</li>
            <li><strong>Financial &amp; Integration Data:</strong> Data synced from third-party integrations (e.g., Shopify, Bosta) and user-uploaded content (e.g., Instapay screenshots, expense voice notes).</li>
            <li><strong>Usage Data:</strong> Information about how you interact with our platform to improve our AI models and user experience.</li>
          </ul>

          <h2 className="text-xl font-semibold text-zinc-900 mt-8 mb-4">How We Use Your Information:</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>To provide and maintain our core services, including AI receipt parsing and profitability analytics.</li>
            <li>To process payments and manage your subscription tiers safely.</li>
            <li>To communicate with you regarding updates, security alerts, and support.</li>
          </ul>

          <h2 className="text-xl font-semibold text-zinc-900 mt-8 mb-4">Data Security:</h2>
          <p>
            We employ industry-standard encryption to protect your sensitive financial data. We do not sell your personal or financial data to third parties. Data processed by our AI partners is strictly utilized for your account&apos;s computational requests and is not used to train public models.
          </p>
          <p className="mt-8">
            If you have any questions, contact us at <a href="mailto:abdullah.mostafa.zaki@gmail.com" className="text-[#1aa772] hover:underline transition-colors">abdullah.mostafa.zaki@gmail.com</a>.
          </p>
        </div>
      </main>
    </>
  )
}
