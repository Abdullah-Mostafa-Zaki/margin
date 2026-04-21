"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { User, LogOut, Menu, X, LayoutDashboard, Receipt, Tags as TagsIcon, Settings } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface TopNavProps {
  orgSlug: string;
  userName: string;
  userImage?: string | null;
}

export default function TopNav({ orgSlug, userName, userImage }: TopNavProps) {
  const [openProfile, setOpenProfile] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setOpenProfile(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close mobile menu when pathname changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isMobileMenuOpen]);

  const navigation = [
    { name: "Dashboard", href: `/${orgSlug}`, icon: LayoutDashboard },
    { name: "Transactions", href: `/${orgSlug}/transactions`, icon: Receipt },
    { name: "Drops", href: `/${orgSlug}/tags`, icon: TagsIcon },
    { name: "Settings", href: `/${orgSlug}/settings`, icon: Settings },
  ];

  return (
    <>
      <header className="w-full border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="w-full px-6 h-16 flex items-center justify-between">
          {/* ── Left Column: Universal Hamburger ── */}
          <div className="flex-1 flex justify-start">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 -ml-2 rounded-md text-zinc-600 hover:bg-zinc-100 transition-colors"
              aria-label="Open menu"
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>

          {/* ── Middle Column: Universal Centered Logo ── */}
          <Link href={orgSlug ? `/${orgSlug}` : '/'} className="flex-shrink-0 flex items-center gap-2">
            <Image src="/logo.svg" alt="Margin Logo" width={24} height={24} />
            <span className="font-bold text-lg tracking-tight">Margin</span>
          </Link>

          {/* ── Right Column: Profile Pill ── */}
          <div className="flex flex-1 justify-end items-center gap-4">
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setOpenProfile(!openProfile)}
                className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white p-1 pr-3 text-sm font-medium hover:bg-zinc-50 transition-colors cursor-pointer shadow-sm"
              >
                {userImage ? (
                  <img
                    src={userImage}
                    alt={userName || "Brand"}
                    className="h-8 w-8 rounded-full bg-zinc-100 object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-600">
                    <User className="h-4 w-4" />
                  </div>
                )}
                <span className="hidden md:inline-block truncate max-w-[120px]">
                  {userName}
                </span>
              </button>

              {openProfile && (
                <div className="absolute right-0 top-full mt-2 w-48 rounded-md border bg-white py-1 shadow-lg z-50">
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: "/login", redirect: true })}
                    className="flex w-full items-center px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 cursor-pointer"
                  >
                    <LogOut className="mr-3 h-4 w-4 text-zinc-400" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Universal Drawer Overlay ── */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100]">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Sliding Panel */}
          <div className="absolute inset-y-0 left-0 w-64 bg-white shadow-xl flex flex-col animate-in slide-in-from-left duration-300">
            <div className="flex h-16 items-center justify-between px-6 border-b shrink-0">
              <Link href={orgSlug ? `/${orgSlug}` : '/'} className="flex items-center gap-2">
                <Image src="/logo.svg" alt="Margin Logo" width={28} height={28} />
                <span className="font-bold text-xl tracking-tight">Margin</span>
              </Link>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 -mr-2 rounded-md flex items-center justify-center text-zinc-500 hover:bg-zinc-100 transition-colors"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-4 space-y-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`group flex items-center rounded-md px-3 py-3 text-sm font-medium transition-colors ${
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
        </div>
      )}
    </>
  );
}