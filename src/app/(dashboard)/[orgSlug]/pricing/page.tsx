import React from 'react';
import prisma from "@/lib/prisma";
import { PricingGrid } from '@/components/pricing-grid';
import Link from 'next/link';

export default async function PricingPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const resolvedParams = await params;
  let currentPlan = null;
  
  const org = await prisma.organization.findFirst({ where: { deletedAt: null,  slug: resolvedParams.orgSlug },
    select: { plan: true }
  });

  if (org) {
    currentPlan = org.plan.toUpperCase();
  }

  return (
    <div className="w-full relative pb-24 h-full">
      {/* Free Period Overlay */}
      <div className="absolute inset-0 z-50 flex items-start justify-center pt-32 bg-white/40 backdrop-blur-sm">
        <div className="bg-white border shadow-xl rounded-2xl p-12 max-w-lg min-h-[280px] text-center flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-500 mt-16 mx-4">
          <h2 className="text-2xl font-bold text-zinc-900 mb-3">You're in the free period</h2>
          <p className="text-base text-zinc-600 mb-8">
            Congrats, Margin's free until Nov 1st. We just haven't figured out how to charge you yet.
          </p>
          <Link 
            href={`/${resolvedParams.orgSlug}`}
            className="inline-flex items-center justify-center font-medium bg-[#10B981] text-white px-8 py-3 rounded-lg hover:bg-[#0EA5E9] transition-all duration-200"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>

      <div className="text-center max-w-3xl mx-auto mb-16 pt-10">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 mb-4">
          Simple, transparent pricing
        </h1>
        <p className="text-lg text-zinc-500">
          Choose the plan that best fits your brand's growth phase.
        </p>
      </div>

      <div className="opacity-40 pointer-events-none select-none filter blur-[3px] h-[50vh] overflow-hidden mask-image-bottom">
        <div style={{ maskImage: "linear-gradient(to bottom, black 50%, transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, black 50%, transparent 100%)" }}>
          <PricingGrid currentPlan={currentPlan} orgSlug={resolvedParams.orgSlug} />
        </div>
      </div>
    </div>
  );
}
