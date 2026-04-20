"use client";

import type { Transaction } from "@prisma/client";
import { DeleteTransactionButton } from "@/components/transactions/action-buttons";

export function MobileTransactionCard({ transaction, orgSlug, onEdit }: { transaction: Transaction; orgSlug: string; onEdit?: () => void }) {
  const t = transaction;
  return (
    <div 
      className="flex items-center justify-between p-4 rounded-xl shadow-sm border bg-white active:scale-95 transition-transform duration-75 min-h-[44px] cursor-pointer"
      onClick={onEdit}
    >
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className="font-bold text-zinc-900">{t.category}</span>
          {t.receiptUrl && (
            <a href={t.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-600 hover:underline bg-blue-50 px-1.5 py-0.5 rounded" onClick={(e) => e.stopPropagation()}>
              Receipt
            </a>
          )}
        </div>
        <span className="text-xs text-zinc-500 mt-0.5">
          {new Date(t.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        </span>
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <span className={`font-medium ${t.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>
          {t.type === 'INCOME' ? '+' : '-'} {Number(t.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-500 px-1.5 py-0.5 rounded-md border bg-zinc-50 uppercase tracking-wide">
            {t.paymentMethod}
          </span>
          <div onClick={(e) => e.stopPropagation()}>
             <DeleteTransactionButton 
               id={t.id} 
               orgSlug={orgSlug} 
               className="h-5 px-1.5 text-[10px] active:scale-95 transition-transform duration-75"
             />
          </div>
        </div>
      </div>
    </div>
  );
}
