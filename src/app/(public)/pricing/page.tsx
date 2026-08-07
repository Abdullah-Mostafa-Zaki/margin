import { PricingGrid } from '@/components/pricing-grid';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing | Margin',
  description: 'Simple, transparent pricing for e-commerce brands.',
};

export default function PublicPricingPage() {
  return (
    <>
      <main className="flex-1 w-full relative pb-24 h-[calc(100vh-80px)] overflow-hidden">
        {/* Free Period Overlay */}
        <div className="absolute inset-0 z-50 flex items-start justify-center pt-32 bg-white/40 backdrop-blur-sm">
          <div className="bg-white border shadow-xl rounded-2xl p-8 max-w-md text-center flex flex-col items-center animate-in fade-in zoom-in-95 duration-500 mt-16 mx-4">
            <h2 className="text-xl font-bold text-zinc-900 mb-2">Margin is free</h2>
            <p className="text-sm text-zinc-600 mb-6">
              Congrats, Margin's free until Nov 1st. We just haven't figured out how to charge you yet.
            </p>
            <a 
              href="/onboarding"
              className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-8 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
            >
              Get Started
            </a>
          </div>
        </div>

        <div className="text-center max-w-3xl mx-auto mb-16 pt-24 px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-lg text-zinc-500">
            Choose the plan that best fits your brand's growth phase.
          </p>
        </div>
        
        <div className="opacity-40 pointer-events-none select-none filter blur-[3px] h-[50vh] overflow-hidden mask-image-bottom px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div style={{ maskImage: "linear-gradient(to bottom, black 50%, transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, black 50%, transparent 100%)" }}>
            <PricingGrid />
          </div>
        </div>
      </main>
    </>
  );
}
