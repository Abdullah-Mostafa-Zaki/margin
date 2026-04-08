"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteTag } from "@/actions/tags.actions";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DeleteTagButton({ id, orgSlug }: { id: string; orgSlug: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this tag? This will remove it from all linked transactions.")) {
      startTransition(async () => {
        try {
          await deleteTag(id, orgSlug);
          router.refresh();
        } catch (error) {
          console.error(error);
          alert("Failed to delete tag");
        }
      });
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleDelete}
      disabled={isPending}
      className="text-red-600 hover:text-red-700 hover:bg-red-50"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
