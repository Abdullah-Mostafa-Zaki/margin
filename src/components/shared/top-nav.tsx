"use client";

import { signOut } from "next-auth/react";
import { User, LogOut } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface TopNavProps {
  userName: string;
  userImage?: string | null;
}

export default function TopNav({ userName, userImage }: TopNavProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="flex h-16 w-full items-center justify-between border-b bg-white px-6">
      <div className="flex-1" />

      <div className="flex items-center gap-4">
        <div className="relative" ref={ref}>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white p-1 pr-3 text-sm font-medium hover:bg-zinc-50 transition-colors cursor-pointer"
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

          {open && (
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
    </header>
  );
}