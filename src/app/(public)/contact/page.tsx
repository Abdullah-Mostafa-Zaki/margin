import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Contact Us & Address | Margin",
}

export default function ContactPage() {
  return (
    <>
      <main className="flex-1 w-full max-w-3xl mx-auto py-16 px-4 md:px-8">
        <h1 className="text-3xl font-bold text-zinc-900 mb-8">Contact Us &amp; Address</h1>
        
        <div className="space-y-6 text-zinc-600 leading-relaxed">
          <p>
            We are here to help you scale your business. If you have any inquiries, technical issues, or need help setting up your integrations, please reach out to us:
          </p>
          
          <div className="mt-8">
            <p><strong>Email:</strong> <a href="mailto:abdullah.mostafa.zaki@gmail.com" className="text-[#1aa772] hover:underline transition-colors">abdullah.mostafa.zaki@gmail.com</a></p>
            <p><strong>Support Hours:</strong> Sunday to Thursday, 9:00 AM – 5:00 PM CLT</p>
          </div>

          <div className="mt-8">
            <h2 className="text-xl font-semibold text-zinc-900 mb-2">Company Address:</h2>
            <address className="not-italic">
              Margin<br />
              Cairo, Egypt
            </address>
          </div>
        </div>
      </main>
    </>
  )
}
