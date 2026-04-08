"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Receipt, Tags, Settings } from "lucide-react";

interface SidebarProps {
  orgSlug: string;
  orgName: string;
}

export default function Sidebar({ orgSlug, orgName }: SidebarProps) {
  const pathname = usePathname();

  const navigation = [
    { name: "Brand Dashboard", href: `/${orgSlug}`, icon: LayoutDashboard },
    { name: "Transactions", href: `/${orgSlug}/transactions`, icon: Receipt },
    { name: "Drops", href: `/${orgSlug}/tags`, icon: Tags },
    { name: "Settings", href: `/${orgSlug}/settings`, icon: Settings },
  ];

  return (
    <div className="flex w-full flex-col border-b bg-white md:w-64 md:border-b-0 md:border-r">
      <div className="flex h-16 items-center border-b px-6">
        <span className="font-semibold text-lg truncate">{orgName}</span>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-zinc-100 text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
              }`}
            >
              <item.icon
                className={`mr-3 h-5 w-5 flex-shrink-0 ${
                  isActive ? "text-zinc-900" : "text-zinc-400 group-hover:text-zinc-500"
                }`}
                aria-hidden="true"
              />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
