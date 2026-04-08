import Link from "next/link";
import { ShieldX } from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 p-4">
      <div className="w-full max-w-md rounded-lg border bg-white p-8 shadow-sm text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 mb-6">
          <ShieldX className="h-8 w-8 text-red-600" />
        </div>
        
        <h1 className="mb-2 text-2xl font-bold tracking-tight text-zinc-900">Access Denied</h1>
        <p className="mb-8 text-sm text-zinc-500">
          You do not have permission to view this organization or it does not exist.
        </p>
        
        <Link
          href="/onboarding"
          className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-8 text-sm font-medium text-zinc-50 hover:bg-zinc-900/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 w-full transition-colors"
        >
          Return to My Groups
        </Link>
      </div>
    </div>
  );
}
