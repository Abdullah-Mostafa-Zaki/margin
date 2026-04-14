"use client";

import { useState, useTransition } from "react";
import { updateOrganizationName } from "@/actions/organization.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function EditOrgForm({ organization }: { organization: { id: string; name: string } }) {
  const [name, setName] = useState(organization.name);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSave = () => {
    if (name.trim() === "" || name === organization.name) return;

    startTransition(async () => {
      try {
        await updateOrganizationName(organization.id, name);
        router.refresh();
      } catch (error) {
        console.error("Failed to update organization name:", error);
        alert("Failed to update organization name");
      }
    });
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Brand Name</label>
      <div className="flex flex-wrap gap-2 w-full">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isPending}
          className="flex-1 min-w-0 w-full"
        />
        <Button onClick={handleSave} disabled={isPending || name === organization.name || name.trim() === ""}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save
        </Button>
      </div>
    </div>
  );
}
