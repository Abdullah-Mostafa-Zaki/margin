"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Receipt, Tags, Settings } from "lucide-react";

interface SidebarProps {
  orgSlug: string;
  orgName: string;
}

export default function Sidebar({ orgSlug, orgName }: SidebarProps) {
  const pathname = usePathname();

  const navigation = [
    { name: "Dashboard", href: `/${orgSlug}`, icon: LayoutDashboard },
    { name: "Transactions", href: `/${orgSlug}/transactions`, icon: Receipt },
    { name: "Drops", href: `/${orgSlug}/tags`, icon: Tags },
    { name: "Settings", href: `/${orgSlug}/settings`, icon: Settings },
  ];

  return (
    <>
      {/* ── Desktop: left sidebar ── */}
      <div className="hidden md:flex w-64 flex-col border-r bg-white shrink-0">
        <div className="flex h-16 items-center border-b px-6 gap-2">
          <Image src="/logo.svg" alt="Margin Logo" width={32} height={32} />
          <span className="font-bold text-xl tracking-tight">Margin</span>
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

      {/* ── Mobile: fixed bottom tab bar ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t bg-white md:hidden">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors ${
                isActive ? "text-zinc-900" : "text-zinc-400"
              }`}
            >
              <item.icon
                className={`h-5 w-5 ${isActive ? "text-zinc-900" : "text-zinc-400"}`}
                aria-hidden="true"
              />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
