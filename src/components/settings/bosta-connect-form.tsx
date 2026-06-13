"use client";

import { useState } from "react";
import { connectBostaAccount, disconnectBostaAccount } from "@/actions/bosta.actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2, Truck } from "lucide-react";
import { UpgradeOverlay } from "@/components/ui/upgrade-overlay";

export function BostaConnectForm({ 
  orgId, 
  isConnectedInitially,
  onCredentialsSubmit,
  isLocked = false
}: { 
  orgId?: string, 
  isConnectedInitially?: boolean,
  onCredentialsSubmit?: (email: string, pass: string) => Promise<{success: boolean, error?: string}>,
  isLocked?: boolean
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(isConnectedInitially);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (onCredentialsSubmit) {
        const result = await onCredentialsSubmit(email, password);
        if (result.success) {
          setIsConnected(true);
        } else {
          setError(result.error || "Failed to connect to Bosta");
        }
      } else if (orgId) {
        const result = await connectBostaAccount(email, password, orgId);
        if (result.success) {
          setIsConnected(true);
        } else {
          setError(result.error || "Failed to connect to Bosta");
        }
      }

    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDisconnect() {
    setIsDisconnecting(true);
    setError(null);
    try {
      if (onCredentialsSubmit) {
        setIsConnected(false);
        setEmail("");
        setPassword("");
      } else if (orgId) {
        const result = await disconnectBostaAccount(orgId);
        if (result.success) {
          setIsConnected(false);
          setEmail("");
          setPassword("");
        } else {
          setError(result.error || "Failed to disconnect");
        }
      }

    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setIsDisconnecting(false);
    }
  }

  if (isConnected) {
    return (
      <UpgradeOverlay locked={isLocked} message="Upgrade to PRO to unlock Bosta Sync">
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="pt-6 flex flex-col items-center justify-center text-center space-y-4">
          <CheckCircle2 className="w-12 h-12 text-emerald-500" />
          <div>
            <h3 className="font-semibold text-emerald-900 text-lg">Bosta Account Connected Successfully</h3>
            <p className="text-sm text-emerald-700 mt-1">Your COD orders are now securely synced.</p>
          </div>
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md w-full max-w-sm">
              {error}
            </div>
          )}
          <Button 
            variant="outline" 
            onClick={handleDisconnect} 
            disabled={isDisconnecting}
            className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
          >
            {isDisconnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Disconnect Account
          </Button>
        </CardContent>
      </Card>
      </UpgradeOverlay>
    );
  }

  return (
    <UpgradeOverlay locked={isLocked} message="Upgrade to PRO to unlock Bosta Sync">
      <Card>
        <CardHeader>
        <div className="flex items-center gap-2 mb-1">
          <Truck className="w-5 h-5 text-red-600" />
          <CardTitle>Connect Bosta</CardTitle>
        </div>
        <CardDescription>
          Link your Bosta account to automatically track your COD shipments and calculate accurate cash flow.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="bosta-email">Email</Label>
            <Input
              id="bosta-email"
              type="email"
              placeholder="admin@yourstore.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bosta-password">Password</Label>
            <Input
              id="bosta-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isSubmitting} className="w-full bg-red-600 hover:bg-red-700 text-white">
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Connect Account
          </Button>
        </CardFooter>
      </form>
    </Card>
    </UpgradeOverlay>
  );
}
