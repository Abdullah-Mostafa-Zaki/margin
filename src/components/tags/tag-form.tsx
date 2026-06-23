"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createTag } from "@/actions/tags.actions";
import { Plus } from "lucide-react";
import { usePlan } from "@/lib/plan-context";
import { PLAN_LIMITS } from "@/lib/plans";

export default function TagForm({ orgSlug, currentDropCount = 0 }: { orgSlug: string; currentDropCount?: number }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const plan = usePlan();
  const maxDrops = PLAN_LIMITS[plan].maxDrops;
  const isLocked = currentDropCount >= maxDrops;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const startDate = formData.get("startDate") as string;
    const endDate = formData.get("endDate") as string;

    if (startDate && endDate) {
      if (new Date(endDate) < new Date(startDate)) {
        setError("End Date cannot be before Start Date");
        return;
      }
    }

    setError(null);
    startTransition(async () => {
      try {
        const res = await createTag(orgSlug, name, description, startDate || undefined, endDate || undefined);
        if (res?.error) {
          setError(res.error);
          return;
        }
        setIsOpen(false);
        router.refresh();
      } catch (err) {
        console.error(err);
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) setError(null);
    }}>
      {isLocked ? (
        <div title="You've reached your Drop limit. Upgrade for more.">
          <Button disabled className="gap-2 opacity-50 cursor-not-allowed">
            <Plus className="h-4 w-4" />
            Create Drop
          </Button>
        </div>
      ) : (
        <DialogTrigger asChild>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Create Drop
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Drop</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Tag Name</label>
            <input
              type="text"
              name="name"
              required
              className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
              placeholder="e.g. Summer Drop 2024"
              onChange={() => setError(null)}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <input
                type="date"
                name="startDate"
                className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">End Date</label>
              <input
                type="date"
                name="endDate"
                className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>
          {error && <p className="text-sm font-medium text-red-500">{error}</p>}

          <div className="space-y-2">
            <label className="text-sm font-medium">Description (Optional)</label>
            <textarea
              name="description"
              className="flex min-h-[80px] w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
              placeholder="Track ROI for new summer collection..."
            />
          </div>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Creating..." : "Create Drop"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
