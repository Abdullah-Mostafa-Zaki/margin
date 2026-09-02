"use client";

import { SessionProvider as NextAuthSessionProvider, useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { saveUserPhone } from "@/app/_actions/auth";

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

function RequirePhoneDialog() {
  const { data: session, update } = useSession();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // If session exists but there is no phone, require it.
  const needsPhone = session?.user && !(session.user as any).phone;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    let normalizedPhone = phone.replace(/^0/, "");
    if (!/^1[0125][0-9]{8}$/.test(normalizedPhone)) {
      setError("Invalid phone number. Must be a valid Egyptian mobile number.");
      setLoading(false);
      return;
    }

    const res = await saveUserPhone(phone);
    if (!res.success) {
      setError(res.error);
      setLoading(false);
      return;
    }

    // Call update to trigger the next-auth jwt/session callbacks and inject the phone
    await update({ phone: `+20${normalizedPhone}` });
    setLoading(false);
  };

  return (
    <Dialog open={!!needsPhone}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Phone Number Required</DialogTitle>
          <DialogDescription>
            Please add a phone number to continue using Margin.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="global-phone">Phone Number</Label>
            <div className="flex">
              <div className="flex items-center justify-center bg-muted text-muted-foreground border border-input border-r-0 rounded-l-md px-3 text-sm font-medium">
                +20
              </div>
              <Input
                id="global-phone"
                type="tel"
                placeholder="106 308 0622"
                className="rounded-l-none"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                autoComplete="tel-local"
              />
            </div>
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Saving..." : "Save and Continue"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthSessionProvider>
      <SessionGuard>{children}</SessionGuard>
      <RequirePhoneDialog />
    </NextAuthSessionProvider>
  );
}
