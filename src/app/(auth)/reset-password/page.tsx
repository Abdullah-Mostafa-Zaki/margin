"use client";

import Image from "next/image";
import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { resetPassword } from "@/app/_actions/auth";
import Link from "next/link";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Guard: no token in URL
  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-50 p-4">
        <Card className="w-full max-w-sm shadow-sm">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-2">
              <Image src="/logo.svg" alt="Margin Logo" width={48} height={48} />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">Invalid Link</CardTitle>
            <CardDescription>
              This reset link is missing or malformed. Please request a new one.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login">
              <Button className="w-full">Back to Sign In</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const result = await resetPassword(token, newPassword);
    setLoading(false);

    if (!result.success) {
      setError(result.error);
    } else {
      setSuccess(true);
      // Redirect to login after 2 seconds
      setTimeout(() => router.push("/login"), 2000);
    }
  };

  // ── Success state ────────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-50 p-4">
        <Card className="w-full max-w-sm shadow-sm">
          <CardHeader className="text-center space-y-1 pb-4">
            <div className="flex justify-center mb-2">
              <Image src="/logo.svg" alt="Margin Logo" width={48} height={48} />
            </div>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">Password Updated</CardTitle>
            <CardDescription>
              Your password has been reset. Redirecting you to sign in…
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login">
              <Button className="w-full" variant="outline">Go to Sign In</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Main form ────────────────────────────────────────────────────────────────
  return (
    <div className="flex items-center justify-center min-h-screen bg-zinc-50 p-4">
      <Card className="w-full max-w-sm shadow-sm">
        <CardHeader className="space-y-1 text-center pb-4">
          <div className="flex justify-center mb-2">
            <Image src="/logo.svg" alt="Margin Logo" width={48} height={48} />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Choose New Password</CardTitle>
          <CardDescription>
            Enter a new password for your account. Make it strong.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Min. 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Repeat your new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Updating…" : "Reset Password"}
            </Button>

            <p className="text-center text-sm text-zinc-500">
              <Link
                href="/login"
                className="font-medium text-zinc-900 underline-offset-4 hover:underline"
              >
                ← Back to Sign In
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
