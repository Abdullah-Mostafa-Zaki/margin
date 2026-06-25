import Link from 'next/link'
import Image from 'next/image'

export function Navbar() {
  return (
    <nav className="relative z-10 border-b border-zinc-200 bg-white/50 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.3)] overflow-hidden p-1.5">
            <Image
              src="/logo.svg"
              alt="Margin Logo"
              width={32}
              height={32}
              className="w-full h-full object-contain"
            />
          </div>
          <span className="text-[20px] font-semibold tracking-tight text-zinc-900">Margin.</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors hidden sm:block"
          >
            Sign In
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium bg-[#10B981] text-white px-5 py-2.5 rounded-lg hover:bg-[#0EA5E9] hover:text-white transition-all duration-200"
          >
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  )
}
