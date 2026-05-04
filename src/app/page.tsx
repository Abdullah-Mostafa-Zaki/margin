import Link from 'next/link'
import Image from 'next/image'
import { Playfair_Display, DM_Sans } from 'next/font/google'

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  style: ['normal', 'italic'],
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
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

export default function LandingPage() {
  return (
    <div
      className={`${dmSans.className} min-h-screen flex flex-col bg-[#08080A] text-[#F0EAE0] relative overflow-hidden`}
      style={{ fontFeatureSettings: '"ss01"' }}
    >
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(#10B981 1px, transparent 1px), linear-gradient(90deg, #10B981 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Radial glow */}
      <div
        className="absolute top-[-20%] left-[50%] translate-x-[-50%] w-[800px] h-[800px] rounded-full opacity-[0.08] pointer-events-none"
        style={{
          background: 'radial-gradient(circle, #10B981 0%, transparent 70%)',
        }}
      />

      {/* ─── Navigation ─── */}
      <nav className="relative z-10 border-b border-[#1C1C22] bg-[#08080A]/50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* White app-icon wrapper for your specific logo */}
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.3)] overflow-hidden p-1.5">
              <Image
                src="/logo.svg"
                alt="Margin Logo"
                width={32}
                height={32}
                className="w-full h-full object-contain"
              />
            </div>
            <span className="text-[20px] font-semibold tracking-tight text-[#F0EAE0]">Margin.</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/auth"
              className="text-sm font-medium text-[#8A8490] hover:text-[#F0EAE0] transition-colors hidden sm:block"
            >
              Sign In
            </Link>
            <Link
              href="/auth"
              className="text-sm font-medium bg-[#10B981] text-[#08080A] px-5 py-2.5 rounded-lg hover:bg-[#0EA5E9] hover:text-white transition-all duration-200"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

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
          <h1 className={`${playfair.className} text-[60px] md:text-[80px] leading-[1.05] font-bold text-[#F0EAE0] tracking-tight`}>
            Stop typing expenses.
            <br />
            <span className="text-[#10B981] italic">Let AI do the math.</span>
          </h1>

          {/* Subheadline */}
          <p className="text-[18px] md:text-[22px] leading-relaxed text-[#8A8490] max-w-2xl mx-auto">
            The first financial dashboard built for the local hustle. Connect Shopify, upload Instapay receipts, and let AI track your real profitability per drop.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-5 pt-4">
            <Link
              href="/auth"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-[#10B981] text-[#08080A] text-[16px] font-bold hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all duration-200 hover:scale-105 active:scale-95"
            >
              Create Free Workspace
            </Link>
            <Link
              href="/auth"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-[#111116] border border-[#2A2A32] text-[#F0EAE0] text-[16px] font-medium hover:bg-[#1C1C22] hover:border-[#10B981]/50 transition-all duration-200"
            >
              Sign in to Dashboard
            </Link>
          </div>
        </div>

        {/* ─── Feature Grid ─── */}
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-6 mt-32 text-left">
          {features.map((f, i) => (
            <div key={i} className="p-8 rounded-2xl border border-[#1C1C22] bg-[#0B0B0D]/50 hover:border-[#10B981]/40 transition-colors backdrop-blur-sm group">
              <div className="w-12 h-12 rounded-xl bg-[#10B981]/10 border border-[#10B981]/20 flex items-center justify-center mb-6 text-2xl group-hover:scale-110 transition-transform">
                {f.icon}
              </div>
              <h3 className="text-[18px] font-bold text-[#F0EAE0] mb-3">{f.title}</h3>
              <p className="text-[15px] text-[#8A8490] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* ─── Footer Stats ─── */}
      <footer className="relative z-10 border-t border-[#1C1C22] bg-[#0B0B0D]">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-10">
            {stats.map((s, i) => (
              <div key={i}>
                <p className="text-[20px] font-bold text-[#10B981] tracking-tight">{s.value}</p>
                <p className="text-[12px] text-[#6B6572] mt-1">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="text-[13px] text-[#4A4550]">
            Margin © {new Date().getFullYear()} — Engineered in Egypt.
          </div>
        </div>
      </footer>
    </div>
  )
}
