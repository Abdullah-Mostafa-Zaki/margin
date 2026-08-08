import Link from 'next/link'
import Image from 'next/image'

export function Navbar() {
  return (
    <nav className="relative z-10 border-b border-zinc-200 bg-white/50 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <Image
            src="/MARGIN.png"
            alt="Margin"
            width={96}
            height={48}
            className="object-contain"
          />
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/pricing"
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors hidden sm:block"
          >
            Pricing
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors hidden sm:block"
          >
            Sign In
          </Link>
          <Link
            href="/login?mode=signup"
            className="text-sm font-medium bg-[#10B981] text-white px-5 py-2.5 rounded-lg hover:bg-[#0EA5E9] hover:text-white transition-all duration-200"
          >
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  )
}
