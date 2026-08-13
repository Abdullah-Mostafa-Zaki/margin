"use client";

import { SessionProvider as NextAuthSessionProvider, useSession, signOut } from "next-auth/react";
import { useEffect } from "react";

function SessionGuard({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  useEffect(() => {
    if (session && (session as any).error === "SuspendedAccount") {
      // Force sign out and redirect to the suspended page
      signOut({ callbackUrl: "/suspended" });
    }
  }, [session]);

  return <>{children}</>;
}

export default function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthSessionProvider>
      <SessionGuard>{children}</SessionGuard>
    </NextAuthSessionProvider>
  );
}
