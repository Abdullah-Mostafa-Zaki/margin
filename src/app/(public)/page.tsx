import Link from 'next/link'
import Image from 'next/image'
import { Playfair_Display } from 'next/font/google'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { redirect } from "next/navigation"

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  style: ['normal', 'italic'],
})

const features = [
  {
    title: 'Instapay Vision AI',
    desc: 'Upload screenshots. Our AI instantly reads amounts, dates, and merchants—even in mixed Arabic/English.',
    icon: '📸',
  },
  {
    title: 'Ammiya Voice Notes',
    desc: 'Driving? Just say "I paid the delivery guy 150 pounds". Margin transcribes and logs it automatically.',
    icon: '🎙️',
  },
  {
    title: 'Shopify Sync & COD Escrow',
    desc: 'Track your true Net Margin, Ad Spend, and Courier-held cash in real-time for every drop.',
    icon: '🛍️',
  },
]

const stats = [
  { value: 'EGP', label: 'Native Currency' },
  { value: 'COD', label: 'Cash on Delivery' },
  { value: 'AI', label: 'Automated Entry' },
]

export default async function LandingPage() {
  const session = await getServerSession(authOptions)
  
  if (session?.user?.id) {
    const membership = await prisma.membership.findFirst({
      where: { userId: session.user.id },
      include: { organization: true }
    })
    
    if (membership?.organization?.slug) {
      redirect(`/${membership.organization.slug}`)
    } else {
      redirect('/onboarding')
    }
  }

  return (
    <>

      {/* ─── Main Hero Content ─── */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="max-w-4xl mx-auto space-y-10">

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#10B981]/30 bg-[#10B981]/10 backdrop-blur-sm mx-auto">
            <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
            <span className="text-[13px] text-[#10B981] font-semibold tracking-wide uppercase">
              Built for Egyptian E-commerce Brands
            </span>
          </div>

          {/* Headline */}
          <h1 className={`${playfair.className} text-[60px] md:text-[80px] leading-[1.05] font-bold text-zinc-900 tracking-tight`}>
            Stop typing expenses.
            <br />
            <span className="text-[#10B981] italic">Let AI do the math.</span>
          </h1>

          {/* Subheadline */}
          <p className="text-[18px] md:text-[22px] leading-relaxed text-zinc-600 max-w-2xl mx-auto">
            The first financial dashboard built for the local hustle. Connect Shopify, upload Instapay receipts, and let AI track your real profitability per drop.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-5 pt-4">
            <Link
              href="/login"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-[#10B981] text-white text-[16px] font-bold hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all duration-200 hover:scale-105 active:scale-95"
            >
              Create Free Workspace
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white border border-zinc-200 text-zinc-900 text-[16px] font-medium hover:bg-zinc-50 hover:border-[#10B981]/50 transition-all duration-200 shadow-sm"
            >
              Sign in to Dashboard
            </Link>
          </div>
        </div>

        {/* ─── Feature Grid ─── */}
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-6 mt-32 text-left">
          {features.map((f, i) => (
            <div key={i} className="p-8 rounded-2xl border border-zinc-200 bg-white hover:border-[#10B981]/40 transition-colors shadow-sm group">
              <div className="w-12 h-12 rounded-xl bg-[#10B981]/10 border border-[#10B981]/20 flex items-center justify-center mb-6 text-2xl group-hover:scale-110 transition-transform">
                {f.icon}
              </div>
              <h3 className="text-[18px] font-bold text-zinc-900 mb-3">{f.title}</h3>
              <p className="text-[15px] text-zinc-600 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

    </>
  )
}
