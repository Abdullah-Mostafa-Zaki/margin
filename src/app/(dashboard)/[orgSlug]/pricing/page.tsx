import React from 'react';
import prisma from "@/lib/prisma";
import { PricingGrid } from '@/components/pricing-grid';

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
    <div className="w-full">
      <div className="text-center max-w-3xl mx-auto mb-16 pt-10">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 mb-4">
          Simple, transparent pricing
        </h1>
        <p className="text-lg text-zinc-500">
          Choose the plan that best fits your brand's growth phase.
        </p>
      </div>

      <PricingGrid currentPlan={currentPlan} orgSlug={resolvedParams.orgSlug} />
    </div>
  );
}
