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
  
  const org = await prisma.organization.findUnique({
    where: { slug: resolvedParams.orgSlug },
    select: { plan: true }
  });

  if (org) {
    currentPlan = org.plan.toUpperCase();
  }

  return (
    <div className="w-full relative pb-24 h-full">
      {/* Free Period Overlay */}
      <div className="absolute inset-0 z-50 flex items-start justify-center pt-32 bg-white/40 backdrop-blur-sm">
        <div className="bg-white border shadow-xl rounded-2xl p-8 max-w-md text-center flex flex-col items-center animate-in fade-in zoom-in-95 duration-500 mt-16 mx-4">
          <h2 className="text-xl font-bold text-zinc-900 mb-2">You're in the free period</h2>
          <p className="text-sm text-zinc-600 mb-6">
            Congrats, Margin's free until Nov 1st. We just haven't figured out how to charge you yet.
          </p>
          <Link 
            href={`/${resolvedParams.orgSlug}`}
            className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-8 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
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
