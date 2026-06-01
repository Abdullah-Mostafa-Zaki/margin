"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { PencilIcon, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DeleteTagButton } from "@/components/tags/action-buttons";
import { updateTag } from "@/actions/tags.actions";
import { toast } from "sonner";

interface DropCardProps {
  id: string;
  orgSlug: string;
  name: string;
  description: string | null;
  startDate: Date | null;
  endDate: Date | null;
  totalIncome: number;
  totalExpenses: number;
  netROI: number;
  transactionCount: number;
}

export function DropCard({
  id,
  orgSlug,
  name,
  description,
  startDate,
  endDate,
  totalIncome,
  totalExpenses,
  netROI,
  transactionCount,
}: DropCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editName, setEditName] = useState(name);
  const [editDesc, setEditDesc] = useState(description || "");
  const [errorMsg, setErrorMsg] = useState("");

  const marginPct = totalIncome > 0 ? ((netROI / totalIncome) * 100).toFixed(1) + "%" : "N/A";

  let dateString = "No transactions yet";
  if (startDate && endDate) {
    // If same day, just show one day
    if (startDate.getTime() === endDate.getTime()) {
      dateString = format(startDate, "MMM d, yyyy");
    } else {
      dateString = `${format(startDate, "MMM d")} – ${format(endDate, "MMM d, yyyy")}`;
    }
  }

  const handleSave = async () => {
    if (!editName.trim()) {
      setErrorMsg("Name is required");
      return;
    }
    
    setErrorMsg("");
    setIsSaving(true);
    
    try {
      await updateTag(id, orgSlug, editName.trim(), editDesc.trim() || undefined);
      toast.success("Drop updated successfully");
      setIsOpen(false);
    } catch (error) {
      if (error instanceof Error) {
        setErrorMsg(error.message);
      } else {
        setErrorMsg("Failed to update drop");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      setEditName(name);
      setEditDesc(description || "");
      setErrorMsg("");
    }
  };

  return (
    <>
      <Card className="flex flex-col relative group">
        <CardHeader className="flex flex-row items-start justify-between pb-2">
          <div className="space-y-1 pr-12">
            <CardTitle className="text-lg leading-tight">{name}</CardTitle>
            <p className="text-xs text-zinc-500 font-medium">{dateString}</p>
            {description && (
              <p className="text-sm text-zinc-500 line-clamp-2 mt-1">{description}</p>
            )}
          </div>
          <div className="flex items-center gap-1 absolute top-4 right-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-zinc-400 hover:text-zinc-900 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => handleOpenChange(true)}
            >
              <PencilIcon className="h-4 w-4" />
            </Button>
            <DeleteTagButton id={id} orgSlug={orgSlug} />
          </div>
        </CardHeader>
        <CardContent className="flex-1 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm mt-4">
            <div className="space-y-1">
              <p className="text-zinc-500">Revenue</p>
              <p className="font-semibold text-emerald-600">EGP {totalIncome.toLocaleString()}</p>
            </div>
            <div className="space-y-1">
              <p className="text-zinc-500">Expenses</p>
              <p className="font-semibold text-rose-600">EGP {totalExpenses.toLocaleString()}</p>
            </div>
          </div>
          
          <div className="rounded-lg bg-zinc-50 p-3 flex justify-between items-center border border-zinc-100">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-zinc-700">Net Profit</span>
              <span className="text-xs text-zinc-500">Margin: {marginPct}</span>
            </div>
            <span className={`font-bold text-lg ${netROI >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {netROI >= 0 ? '+' : ''}EGP {netROI.toLocaleString()}
            </span>
          </div>

          <div className="text-sm text-zinc-500 flex justify-between items-center">
            <span>{transactionCount} transactions</span>
          </div>

          <div className="flex pt-4 mt-auto">
            <Link
              href={`/${orgSlug}/transactions?tag=${id}`}
              className="inline-flex h-9 w-full items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 hover:bg-zinc-900/90 transition-colors"
            >
              Transactions
            </Link>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Drop</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Summer Collection"
              />
              {errorMsg && <p className="text-sm text-red-500 font-medium">{errorMsg}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="Short description..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
