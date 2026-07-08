import React from 'react';
import Link from 'next/link';
import { Bot, LineChart, Package, Users, History, Receipt, Check, X, Truck, Mail, Headphones, Sparkles, BarChart2 } from 'lucide-react';
import { PLAN_PRICES } from '@/lib/plans';

const tiers = [
  {
    name: "Free",
    price: PLAN_PRICES.FREE.toLocaleString(),
    description: "Try it out. Hit the ceiling fast.",
    features: [
      { name: "20 total AI transactions", icon: <Bot className="h-4 w-4 text-emerald-500" /> },
      { name: "1 active drop tracking", icon: <Package className="h-4 w-4 text-emerald-500" /> },
      { name: "1 team member", icon: <Users className="h-4 w-4 text-emerald-500" /> },
      { name: "30-day data history", icon: <History className="h-4 w-4 text-emerald-500" /> },
      { name: "Basic Expenses tracking", icon: <Receipt className="h-4 w-4 text-emerald-500" /> },
    ],
    notIncluded: [
      { name: "No Shopify sync", icon: <X className="h-4 w-4 text-red-500" /> },
      { name: "No Bosta sync", icon: <X className="h-4 w-4 text-red-500" /> },
      { name: "No automated reports", icon: <X className="h-4 w-4 text-red-500" /> },
    ]
  },
  {
    name: "Plus",
    price: PLAN_PRICES.PLUS.toLocaleString(),
    description: "Automate the grunt work.",
    features: [
      { name: "100 total AI transactions", icon: <Bot className="h-4 w-4 text-emerald-500" /> },
      { name: "Shopify live sync", icon: <Sparkles className="h-4 w-4 text-emerald-500" />, badge: "unlocked" },
      { name: "Full Expenses tracking", icon: <Receipt className="h-4 w-4 text-emerald-500" /> },
      { name: "Up to 5 active drops", icon: <Package className="h-4 w-4 text-emerald-500" /> },
      { name: "1 team member", icon: <Users className="h-4 w-4 text-emerald-500" /> },
      { name: "Full data history", icon: <History className="h-4 w-4 text-emerald-500" /> },
      { name: "Basic Analytics", icon: <BarChart2 className="h-4 w-4 text-emerald-500" /> },
      { name: "Monthly & Yearly Reports", icon: <Mail className="h-4 w-4 text-emerald-500" /> },
    ],
    notIncluded: [
      { name: "No Bosta sync", icon: <X className="h-4 w-4 text-red-500" /> },
    ]
  },
  {
    name: "Pro",
    price: PLAN_PRICES.PRO.toLocaleString(),
    description: "The full picture for scaling brands.",
    mostPopular: true,
    features: [
      { name: "500 total AI transactions", icon: <Bot className="h-4 w-4 text-emerald-500" /> },
      { name: "Shopify live sync", icon: <Sparkles className="h-4 w-4 text-emerald-500" /> },
      { name: "Bosta sync", icon: <Truck className="h-4 w-4 text-emerald-500" />, badge: "unlocked" },
      { name: "Full Expenses tracking", icon: <Receipt className="h-4 w-4 text-emerald-500" /> },
      { name: "Unlimited active drops", icon: <Package className="h-4 w-4 text-emerald-500" /> },
      { name: "3 team members", icon: <Users className="h-4 w-4 text-emerald-500" /> },
      { name: "Full data history", icon: <History className="h-4 w-4 text-emerald-500" /> },
      { name: "Full Analytics Suite", icon: <LineChart className="h-4 w-4 text-emerald-500" /> },
      { name: "Monthly, Quarterly & Yearly Reports", icon: <Mail className="h-4 w-4 text-emerald-500" /> },
    ],
    notIncluded: []
  },
  {
    name: "Business",
    price: PLAN_PRICES.BUSINESS.toLocaleString(),
    description: "For real operations with real teams.",
    features: [
      { name: "Unlimited AI transactions", icon: <Bot className="h-4 w-4 text-emerald-500" /> },
      { name: "Shopify live sync", icon: <Sparkles className="h-4 w-4 text-emerald-500" /> },
      { name: "Bosta sync", icon: <Truck className="h-4 w-4 text-emerald-500" /> },
      { name: "Full Expenses tracking", icon: <Receipt className="h-4 w-4 text-emerald-500" /> },
      { name: "Unlimited active drops", icon: <Package className="h-4 w-4 text-emerald-500" /> },
      { name: "Up to 10 team members", icon: <Users className="h-4 w-4 text-emerald-500" /> },
      { name: "Full data history", icon: <History className="h-4 w-4 text-emerald-500" /> },
      { name: "Full Analytics Suite", icon: <LineChart className="h-4 w-4 text-emerald-500" /> },
      { name: "Weekly, Monthly, Quarterly & Yearly Reports", icon: <Mail className="h-4 w-4 text-emerald-500" /> },
      { name: "1 Free Consultation/mo with experts", icon: <Headphones className="h-4 w-4 text-emerald-500" /> },
      { name: "+ Everything in all other tiers", icon: <Check className="h-4 w-4 text-emerald-500" /> },
    ],
    notIncluded: []
  }
];

export interface PricingGridProps {
  currentPlan?: string | null;
  orgSlug?: string;
}

export function PricingGrid({ currentPlan, orgSlug }: PricingGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-stretch w-full max-w-full">
      {tiers.map((tier) => {
        const planOrder = ["FREE", "PLUS", "PRO", "BUSINESS"];
        const currentPlanIndex = currentPlan ? planOrder.indexOf(currentPlan) : 0;
        const tierIndex = planOrder.indexOf(tier.name.toUpperCase());
        
        const isCurrentPlan = currentPlan === tier.name.toUpperCase();
        const isDowngrade = currentPlan ? tierIndex < currentPlanIndex : false;
        
        let buttonText = 'Upgrade to ' + tier.name;
        if (isCurrentPlan) {
          buttonText = 'Current Plan';
        } else if (isDowngrade) {
          buttonText = 'Downgrade to ' + tier.name;
        } else if (!currentPlan) {
          buttonText = 'Get started';
        }
        
        const href = isCurrentPlan ? "#" : orgSlug ? `/${orgSlug}/payments` : "/login";

        return (
          <div 
            key={tier.name}
            className={`relative flex flex-col rounded-2xl p-6 md:p-8 bg-white border transition-all duration-200 ${
              tier.mostPopular 
                ? 'border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.1)]' 
                : 'border-zinc-200 hover:border-zinc-300 shadow-sm'
            } ${isCurrentPlan ? 'ring-2 ring-zinc-900' : ''}`}
          >
            {tier.mostPopular && !isCurrentPlan && (
              <div className="absolute -top-3 left-6">
                <span className="bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                  Most popular
                </span>
              </div>
            )}
            {isCurrentPlan && (
              <div className="absolute -top-3 left-6">
                <span className="bg-zinc-900 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                  Current Plan
                </span>
              </div>
            )}
            
            <div className="mb-6">
              <h3 className="text-xl font-medium text-zinc-900 mb-2">{tier.name}</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-zinc-900">{tier.price}</span>
                {tier.price !== "0" && <span className="text-lg text-zinc-500">EGP</span>}
                <span className="text-zinc-500">/ month</span>
              </div>
              <p className="mt-4 text-sm text-zinc-500 h-10">{tier.description}</p>
            </div>

            <div className="h-[1px] w-full bg-zinc-200 mb-6"></div>

            <div className="flex-1 space-y-4">
              {tier.features.map((feature, i) => (
                <div key={i} className="flex gap-3">
                  <div className="mt-0.5 shrink-0">{feature.icon}</div>
                  <div className="text-sm">
                    <span className="text-zinc-700">{feature.name}</span>
                    {feature.badge && (
                      <span className="ml-2 inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600 ring-1 ring-inset ring-emerald-500/20">
                        {feature.badge}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              
              {tier.notIncluded.length > 0 && (
                <div className="pt-2 space-y-4">
                  {tier.notIncluded.map((feature, i) => (
                    <div key={`not-${i}`} className="flex gap-3 opacity-60">
                       <div className="mt-0.5 shrink-0">{feature.icon}</div>
                      <div className="text-sm">
                        <span className="text-zinc-500">{feature.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-8 pt-4">
              <Link
                href={href}
                className={`block w-full py-2.5 px-4 rounded-lg text-center text-sm font-semibold transition-colors ${
                  isCurrentPlan
                    ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed border border-zinc-200'
                    : tier.mostPopular
                      ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                      : 'bg-white text-zinc-900 border border-zinc-200 hover:bg-zinc-50'
                }`}
              >
                {buttonText}
              </Link>
            </div>
          </div>
        )
      })}
    </div>
  );
}
