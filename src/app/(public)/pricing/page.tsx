import { PricingGrid } from '@/components/pricing-grid';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing | Margin',
  description: 'Simple, transparent pricing for e-commerce brands.',
};

export default function PublicPricingPage() {
  return (
    <>
      <main className="flex-1 w-full max-w-7xl mx-auto py-24 px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-lg text-zinc-500">
            Choose the plan that best fits your brand's growth phase.
          </p>
        </div>
        
        <PricingGrid />
      </main>
    </>
  );
}
