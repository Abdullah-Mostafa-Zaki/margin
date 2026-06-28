"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RecurringFrequency } from "@prisma/client";
import { createRecurringExpense, updateRecurringExpense, RecurringExpenseData } from "@/app/actions/recurring.actions";

const EXPENSE_CATEGORIES = [
  "Raw Materials",
  "Manufacturing",
  "Packaging",
  "Logistics (Shipping)",
  "Ads",
  "Content Creation",
  "Facilities",
  "Subscriptions",
  "Salaries",
  "Taxes & Legal",
  "Returns & Refunds",
  "Other"
];

interface TagProp {
  id: string;
  name: string;
}

export interface RecurringToEdit {
  id: string;
  name: string;
  amount: number;
  category: string;
  frequency: RecurringFrequency;
  startDate: Date | string;
  dropId?: string | null;
}

interface RecurringModalProps {
  orgSlug: string;
  tags?: TagProp[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editData?: RecurringToEdit | null;
  onSuccess: () => void;
}

export function RecurringModal({ orgSlug, tags = [], open, onOpenChange, editData, onSuccess }: RecurringModalProps) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Subscriptions");
  const [frequency, setFrequency] = useState<RecurringFrequency>("MONTHLY");
  const [startDate, setStartDate] = useState("");
  const [dropId, setDropId] = useState("none");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      if (editData) {
        setName(editData.name);
        setAmount(editData.amount.toString());
        setCategory(editData.category);
        setFrequency(editData.frequency);
        const d = new Date(editData.startDate);
        setStartDate(d.toISOString().split("T")[0]);
        setDropId(editData.dropId || "none");
      } else {
        setName("");
        setAmount("");
        setCategory("Subscriptions");
        setFrequency("MONTHLY");
        const today = new Date();
        setStartDate(today.toISOString().split("T")[0]);
        setDropId("none");
      }
      setError("");
    }
  }, [open, editData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !amount || !startDate) {
      setError("Please fill in all required fields.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data: RecurringExpenseData = {
        name,
        amount: Number(amount),
        category,
        frequency,
        startDate: new Date(startDate),
        dropId: dropId === "none" ? undefined : dropId,
      };

      if (editData) {
        await updateRecurringExpense(orgSlug, editData.id, data);
      } else {
        await createRecurringExpense(orgSlug, data);
      }
      
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{editData ? "Edit Recurring Expense" : "Add Recurring Expense"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Expense Name</Label>
            <Input 
              placeholder="e.g. Shopify Subscription" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Amount (EGP)</Label>
              <Input 
                type="number" 
                step="0.01" 
                placeholder="0.00" 
                value={amount} 
                onChange={e => setAmount(e.target.value)} 
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select value={frequency} onValueChange={(val: any) => setFrequency(val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="YEARLY">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={(val) => setCategory(val as string)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Start Date</Label>
            <Input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)} 
              required
            />
            <p className="text-[10px] text-zinc-500">Expenses will be automatically generated at this frequency based on the start date.</p>
          </div>

          <div className="space-y-2">
            <Label>Associate to Drop (Optional)</Label>
            <Select value={dropId} onValueChange={(val) => setDropId(val as string)}>
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {tags.map((tag) => (
                  <SelectItem key={tag.id} value={tag.id}>
                    {tag.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Saving..." : "Save Recurring Expense"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
