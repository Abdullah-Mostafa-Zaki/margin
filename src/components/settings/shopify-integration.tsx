"use client";

import { useState, useTransition } from "react";
import { updateShopifySecret } from "@/actions/settings.actions";
import { Loader2, Copy, Check, Zap } from "lucide-react";

interface ShopifyIntegrationProps {
  orgSlug: string;
  baseUrl: string;
  hasSecret: boolean;
}

export function ShopifyIntegration({
  orgSlug,
  baseUrl,
  hasSecret,
}: ShopifyIntegrationProps) {
  const webhookUrl = `${baseUrl}/api/webhooks/shopify?orgSlug=${orgSlug}`;

  const [secret, setSecret] = useState("");
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<
    { success: true } | { error: string } | null
  >(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for environments without clipboard API
      console.error("Failed to copy to clipboard");
    }
  };

  const handleSave = () => {
    if (!secret.trim()) return;
    setResult(null);

    startTransition(async () => {
      const res = await updateShopifySecret(orgSlug, secret);
      setResult(res);
      if ("success" in res && res.success) {
        setSecret("");
      }
    });
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
      {/* Card Header */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-zinc-100 bg-gradient-to-r from-zinc-50 to-white">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#96bf48]/10 border border-[#96bf48]/20">
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="#96bf48"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-zinc-900">
            Shopify Integration
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Receive real-time order events from your Shopify store
          </p>
        </div>
        {hasSecret && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Active
          </span>
        )}
      </div>

      <div className="px-6 py-5 space-y-6">
        {/* Setup Instructions */}
        <div className="rounded-lg bg-blue-50 border border-blue-100 p-4">
          <div className="flex items-start gap-2">
            <Zap className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-blue-800">
                Setup Instructions
              </p>
              <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside whitespace-normal break-words">
                <li>
                  Paste the Webhook URL below into{" "}
                  <span className="font-medium">
                    Shopify Settings → Notifications → Webhooks
                  </span>
                  .
                </li>
                <li>
                  Copy the webhook signature secret from the bottom of that
                  Shopify page.
                </li>
                <li>Paste the secret here and save.</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Section 1: Webhook URL */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-700">
            Webhook URL
          </label>
          <div className="flex flex-wrap gap-2 w-full">
            <input
              id="shopify-webhook-url"
              readOnly
              value={webhookUrl}
              className="flex h-10 flex-1 min-w-0 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600 font-mono focus:outline-none cursor-text select-all"
            />
            <button
              id="copy-webhook-url-btn"
              type="button"
              onClick={handleCopy}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-300 whitespace-nowrap"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-500" />
                  <span className="text-emerald-600">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy
                </>
              )}
            </button>
          </div>
        </div>

        {/* Section 2: Secret Key */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="shopify-secret-input"
              className="text-sm font-medium text-zinc-700"
            >
              Webhook Signature Secret
            </label>
            {hasSecret && (
              <span className="text-xs text-zinc-400">
                A secret is already saved — paste a new one to replace it
              </span>
            )}
          </div>
          <input
            id="shopify-secret-input"
            type="password"
            placeholder={
              hasSecret
                ? "Paste new secret to update…"
                : "Paste your Shopify webhook secret…"
            }
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            disabled={isPending}
            className="flex h-10 w-full min-w-0 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent disabled:opacity-50 transition"
          />
        </div>

        {/* Feedback */}
        {result && (
          <div
            className={`rounded-md px-4 py-3 text-sm font-medium ${
              "success" in result && result.success
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {"success" in result && result.success
              ? "✓ Shopify connection saved successfully."
              : `✕ ${"error" in result ? result.error : "An error occurred."}`}
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end pt-1">
          <button
            id="save-shopify-secret-btn"
            type="button"
            onClick={handleSave}
            disabled={isPending || !secret.trim()}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {hasSecret ? "Update Connection" : "Save Connection"}
          </button>
        </div>
      </div>
    </div>
  );
}
