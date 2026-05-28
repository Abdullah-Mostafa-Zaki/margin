import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DropPerformance } from "@/app/actions/getDropPerformance";

export function DropPerformanceTable({ data }: { data: DropPerformance[] }) {
  if (data.length === 0) {
    return (
      <div className="bg-white p-8 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-slate-100 mt-6">
        <h3 className="uppercase tracking-[0.2em] text-[11px] font-bold text-slate-400 mb-8">Drop Performance</h3>
        <div className="text-center text-slate-500 py-8">
          Tag transactions to Drops to see campaign performance here.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-8 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-slate-100 mt-6">
      <h3 className="uppercase tracking-[0.2em] text-[11px] font-bold text-slate-400 mb-6">Drop Performance</h3>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Drop Name</TableHead>
              <TableHead className="text-right whitespace-nowrap">Revenue</TableHead>
              <TableHead className="text-right whitespace-nowrap">Ad Spend</TableHead>
              <TableHead className="text-right whitespace-nowrap">Production Cost</TableHead>
              <TableHead className="text-right whitespace-nowrap">Net Margin</TableHead>
              <TableHead className="text-right whitespace-nowrap">Net Margin %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((drop) => {
              let marginColor = "text-slate-800";
              if (drop.netMarginPercent > 30) marginColor = "text-emerald-600 font-bold";
              else if (drop.netMarginPercent >= 10 && drop.netMarginPercent <= 30) marginColor = "text-amber-500 font-bold";
              else marginColor = "text-red-500 font-bold";

              return (
                <TableRow key={drop.dropName}>
                  <TableCell className="font-medium whitespace-nowrap">{drop.dropName}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{drop.revenue.toLocaleString("en-EG")} EGP</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{drop.adSpend.toLocaleString("en-EG")} EGP</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{drop.productionCost.toLocaleString("en-EG")} EGP</TableCell>
                  <TableCell className="text-right font-medium whitespace-nowrap">{drop.netMargin.toLocaleString("en-EG")} EGP</TableCell>
                  <TableCell className={`text-right whitespace-nowrap ${marginColor}`}>
                    {drop.netMarginPercent.toFixed(1)}%
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
