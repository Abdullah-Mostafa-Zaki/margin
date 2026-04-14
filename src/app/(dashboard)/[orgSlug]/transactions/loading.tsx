import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function TransactionsLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="h-8 w-48 bg-zinc-200 rounded-md mb-2"></div>
          <div className="h-4 w-64 bg-zinc-100 rounded-md"></div>
        </div>
        <div className="flex items-center flex-wrap gap-2">
          <div className="h-10 w-64 bg-zinc-200 rounded-md"></div>
          <div className="h-10 w-24 bg-zinc-200 rounded-md"></div>
          <div className="h-10 w-32 bg-zinc-200 rounded-md"></div>
        </div>
      </div>

      <div className="w-full">
        {/* Desktop Table Skeleton (Hidden on Mobile) */}
        <div className="hidden md:block overflow-x-auto rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><div className="h-4 w-20 bg-zinc-200 rounded"></div></TableCell>
                  <TableCell><div className="h-6 w-16 bg-zinc-200 rounded-full"></div></TableCell>
                  <TableCell><div className="h-4 w-24 bg-zinc-200 rounded"></div></TableCell>
                  <TableCell><div className="h-4 w-16 bg-zinc-200 rounded"></div></TableCell>
                  <TableCell><div className="h-6 w-20 bg-zinc-200 rounded-full"></div></TableCell>
                  <TableCell><div className="h-4 w-20 bg-zinc-200 rounded ml-auto"></div></TableCell>
                  <TableCell><div className="h-4 w-16 bg-zinc-200 rounded ml-auto"></div></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile List Skeleton (Hidden on Desktop) */}
        <div className="md:hidden space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-4 rounded-xl shadow-sm border bg-white min-h-[44px]">
              <div className="flex flex-col gap-2">
                <div className="h-5 w-32 bg-zinc-200 rounded"></div>
                <div className="h-3 w-16 bg-zinc-100 rounded"></div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="h-5 w-24 bg-zinc-200 rounded"></div>
                <div className="h-4 w-12 bg-zinc-100 rounded-full"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
