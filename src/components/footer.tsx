import Link from 'next/link'
import Image from 'next/image'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="relative z-10 border-t border-zinc-200 bg-white">
      <div className="max-w-7xl mx-auto px-6 py-12 md:py-16">
        <div className="flex flex-col md:flex-row justify-between gap-12">
          {/* Logo & Copyright */}
          <div className="flex flex-col gap-4 max-w-sm">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm overflow-hidden p-1 border border-zinc-200">
                <Image
                  src="/logo.svg"
                  alt="Margin Logo"
                  width={24}
                  height={24}
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="text-xl font-semibold tracking-tight text-zinc-900">Margin.</span>
            </div>
            <p className="text-sm text-zinc-500">
              The AI-powered financial operating system built for e-commerce.
            </p>
            <p className="text-sm text-zinc-400 mt-4">
              © {currentYear} Margin. All rights reserved.
            </p>
          </div>

          {/* Link Columns */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-8 md:gap-16">
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-zinc-900">Company</h3>
              <Link href="/about" className="text-sm text-zinc-500 hover:text-[#1aa772] transition-colors">
                About Us
              </Link>
              <Link href="/contact" className="text-sm text-zinc-500 hover:text-[#1aa772] transition-colors">
                Contact Us
              </Link>
            </div>
            
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-zinc-900">Legal</h3>
              <Link href="/terms" className="text-sm text-zinc-500 hover:text-[#1aa772] transition-colors">
                Terms & Conditions
              </Link>
              <Link href="/privacy" className="text-sm text-zinc-500 hover:text-[#1aa772] transition-colors">
                Privacy Policy
              </Link>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-zinc-900">Support</h3>
              <Link href="/refund-policy" className="text-sm text-zinc-500 hover:text-[#1aa772] transition-colors">
                Refund Policy
              </Link>
              <Link href="/shipping-policy" className="text-sm text-zinc-500 hover:text-[#1aa772] transition-colors">
                Shipping Policy
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
