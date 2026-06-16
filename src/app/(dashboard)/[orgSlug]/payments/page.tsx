import React from 'react';
import { CreditCard } from 'lucide-react';
import { PageTracker } from "@/components/analytics/PageTracker";

export default function PaymentsPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 min-h-[80vh]">
      <PageTracker feature="Payments" />
      <div className="bg-white p-12 rounded-3xl border shadow-[0_20px_50px_rgba(0,0,0,0.04)] max-w-md w-full text-center">
        <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <CreditCard className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-bold text-zinc-900 mb-3 tracking-tight">Payments</h1>
        <p className="text-zinc-500 leading-relaxed mb-8">
          This feature is currently under development. Soon you'll be able to manage your subscriptions and billing from here.
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-100 text-sm font-medium text-zinc-600">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          Coming soon
        </div>
      </div>
    </div>
  );
}
