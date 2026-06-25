import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { DM_Sans } from 'next/font/google'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
})

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className={`${dmSans.className} min-h-screen flex flex-col bg-zinc-50 text-zinc-900 relative overflow-hidden`}
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

      <Navbar />
      
      <div className="flex-1 flex flex-col relative z-10 w-full">
        {children}
      </div>

      <Footer />
    </div>
  )
}
