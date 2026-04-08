"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, PlusCircle } from "lucide-react";

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface OrgSwitcherProps {
  activeOrg: Organization;
  allOrgs: Organization[];
}

export default function OrgSwitcher({ activeOrg, allOrgs }: OrgSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  return (
    <div className="relative w-full">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-950"
      >
        <span className="truncate">{activeOrg.name}</span>
        <ChevronsUpDown className="h-4 w-4 text-zinc-500" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-md border bg-white py-1 shadow-lg">
          <div className="max-h-60 overflow-auto">
            {allOrgs.map((org) => (
              <button
                key={org.id}
                onClick={() => {
                  setIsOpen(false);
                  if (org.id !== activeOrg.id) {
                    router.push(`/${org.slug}`);
                  }
                }}
                className={`flex w-full items-center px-3 py-2 text-sm hover:bg-zinc-100 ${
                  org.id === activeOrg.id ? "bg-zinc-50" : ""
                }`}
              >
                <div className="mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border bg-zinc-100 font-bold uppercase text-zinc-500 text-xs">
                  {org.name.substring(0, 2)}
                </div>
                <span className="flex-1 truncate text-left">{org.name}</span>
                {org.id === activeOrg.id && (
                  <Check className="ml-auto h-4 w-4 text-zinc-900" />
                )}
              </button>
            ))}
          </div>
          <div className="border-t px-2 py-1">
            <button
              onClick={() => {
                setIsOpen(false);
                router.push("/onboarding");
              }}
              className="flex w-full items-center rounded-md px-2 py-2 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Create Organization
            </button>
          </div>
        </div>
      )}
      
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
