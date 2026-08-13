'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCairoDate } from "@/lib/date-utils";

type AuditLogType = {
  id: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  targetLabel: string;
  createdAt: Date;
};

export function AuditLogsTable({ auditLogs }: { auditLogs: AuditLogType[] }) {
  return (
    <div className="space-y-4">
      <div className="rounded-md border overflow-x-auto bg-white mt-4">
        {auditLogs.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-sm text-zinc-400">
            No audit logs found.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Actor (Super Admin)</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Target ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm whitespace-nowrap text-zinc-500">
                    {formatCairoDate(new Date(log.createdAt), "MM/dd/yyyy, h:mm:ss a")}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {log.actorEmail}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-zinc-100 text-zinc-800 uppercase">
                      {log.action}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    <span className="font-semibold text-zinc-700">{log.targetType}:</span> {log.targetLabel}
                  </TableCell>
                  <TableCell className="text-xs text-zinc-400 font-mono">
                    {log.targetId}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
