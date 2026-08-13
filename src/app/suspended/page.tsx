import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SuspendedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
      <div className="max-w-md w-full text-center space-y-6 bg-white p-8 rounded-3xl shadow-sm border border-zinc-100">
        <div className="mx-auto w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-zinc-900">Account Suspended</h1>
          <p className="text-zinc-500">
            Your account has been suspended by an administrator. You no longer have access to this platform.
          </p>
        </div>
        <div className="pt-4">
          <Link href="/login" className="w-full">
            <Button className="w-full">Return to Login</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
