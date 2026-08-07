"use client";

import { useState, useEffect } from "react";
import { completeOnboarding } from "@/actions/onboarding.actions";
import { createTag } from "@/actions/tags.actions";
import { Loader2, Zap } from "lucide-react";
import { BostaConnectForm } from "@/components/settings/bosta-connect-form";
import { UnifiedImportModal } from "@/components/dashboard/UnifiedImportModal";
import { useRouter } from "next/navigation";
import { PlanProvider } from "@/lib/plan-context";

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdOrgSlug, setCreatedOrgSlug] = useState<string | null>(null);
  const [createdOrgPlan, setCreatedOrgPlan] = useState<any>("FREE");

  const [formData, setFormData] = useState({
    brandName: "",
    courierFee: 85,
    shopifyWebhookUrl: "",
    shopifyWebhookSecret: "",
    bostaEmail: "",
    bostaPassword: "",
    firstDropName: "",
    firstDropStartDate: "",
    firstDropEndDate: "",
    firstDropDescription: "",
  });

  const [baseUrl, setBaseUrl] = useState("");
  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  const handleNext = () => setStep((s) => s + 1);
  const handleBack = () => setStep((s) => s - 1);

  const handleCreateOrg = async (skipBosta = false) => {
    setIsSubmitting(true);
    try {
      const dataToSubmit = { ...formData };
      if (skipBosta) {
        dataToSubmit.bostaEmail = "";
        dataToSubmit.bostaPassword = "";
      }
      const res = await completeOnboarding(dataToSubmit);
      if (res?.success && res.orgSlug) {
        setCreatedOrgSlug(res.orgSlug);
        if (res.plan) setCreatedOrgPlan(res.plan);
        setStep(5);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinishDrop = async () => {
    if (!createdOrgSlug) return;
    setIsSubmitting(true);
    try {
      if (formData.firstDropName) {
        await createTag(
          createdOrgSlug,
          formData.firstDropName,
          formData.firstDropDescription,
          formData.firstDropStartDate,
          formData.firstDropEndDate
        );
      }
      router.push(`/${createdOrgSlug}`);
    } catch (error) {
      console.error(error);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-sm">
      <div className="mb-8 flex gap-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className={`h-2 flex-1 rounded-full ${step >= i ? "bg-primary" : "bg-muted"}`} />
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Name your brand</h1>
            <p className="text-sm text-muted-foreground mt-2">What are you building?</p>
          </div>
          <input
            type="text" autoFocus required placeholder="e.g. ZAKI"
            value={formData.brandName}
            onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
            className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-center"
          />
          <button
            onClick={handleNext} disabled={!formData.brandName.trim()}
            className="h-10 w-full rounded-md bg-primary text-primary-foreground disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Financial Defaults</h1>
            <p className="text-sm text-muted-foreground mt-2">You can skip this and change it later.</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Average Shipping Cost (EGP)</label>
              <p className="text-xs text-muted-foreground mb-1">This value is automatically logged as a separate shipping expense for every Shopify-synced order.</p>
              <input
                type="number" min="0" value={formData.courierFee}
                onChange={(e) => setFormData({ ...formData, courierFee: Number(e.target.value) })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleBack} className="h-10 px-4 rounded-md border">Back</button>
            <button onClick={handleNext} className="h-10 flex-1 rounded-md bg-primary text-primary-foreground">Continue</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Do you want to connect your Shopify store?</h1>
            <p className="text-sm text-muted-foreground mt-2">Automatically log your daily sales and shipping income directly into your Margin ledger.</p>
          </div>

          <div className="rounded-xl overflow-hidden border shadow-sm w-full aspect-video bg-muted">
            <video
              className="w-full h-full object-cover"
              controls
              autoPlay
              muted
              loop
              playsInline
              src="/video.mp4"
            />
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm">
            <div className="flex items-center gap-2 font-medium mb-2 text-blue-900">
              <Zap className="h-4 w-4" /> Setup Instructions
            </div>
            <ol className="list-decimal pl-5 space-y-1 text-blue-800">
              <li>Paste the Webhook URL below into Shopify Settings &rarr; Notifications &rarr; Webhooks.</li>
              <li>Copy the webhook signature secret at the bottom of the page.</li>
              <li>Paste the secret here and save.</li>
            </ol>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Shopify Webhook URL</label>
              <div className="mt-1 flex">
                <input
                  type="text"
                  readOnly
                  value={`${baseUrl}/api/webhooks/shopify?orgSlug=${formData.brandName ? formData.brandName.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'your-brand'}`}
                  className="flex h-10 w-full rounded-l-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground outline-none"
                />
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(`${baseUrl}/api/webhooks/shopify?orgSlug=${formData.brandName ? formData.brandName.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'your-brand'}`)}
                  className="h-10 px-4 rounded-r-md border border-l-0 border-input bg-zinc-100 hover:bg-zinc-200 text-sm font-medium transition-colors text-zinc-900"
                >
                  Copy
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Webhook Signature Secret</label>
              <input
                type="password" placeholder="whsec_..."
                value={formData.shopifyWebhookSecret}
                onChange={(e) => setFormData({ ...formData, shopifyWebhookSecret: e.target.value })}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2"
              />
            </div>
          </div>

          <div className="flex flex-col pt-2">
            <div className="flex justify-between gap-3">
              <button
                onClick={handleBack}
                className="h-10 px-4 rounded-md border border-input bg-transparent text-sm font-medium hover:bg-muted transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={handleNext}
                disabled={!formData.shopifyWebhookSecret.trim()}
                className="h-10 flex-1 rounded-md bg-zinc-900 border border-zinc-900 text-white font-medium hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Connect Store
              </button>
            </div>
            <div className="mt-6 flex justify-center">
              <button
                onClick={handleNext}
                className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
              >
                Skip for now
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Do you want to connect Bosta?</h1>
            <p className="text-sm text-muted-foreground mt-2">Automatically track your COD shipments and cash flow.</p>
          </div>
          
          <div className="border rounded-lg overflow-hidden">
            <BostaConnectForm 
              onCredentialsSubmit={async (email, pass) => {
                const { testBostaCredentials } = await import("@/actions/bosta.actions");
                const res = await testBostaCredentials(email, pass);
                if (res.success) {
                  setFormData(prev => ({ ...prev, bostaEmail: email, bostaPassword: pass }));
                }
                return res;
              }}
            />
          </div>

          <div className="flex flex-col pt-2">
            <div className="flex justify-between gap-3">
              <button
                onClick={handleBack}
                disabled={isSubmitting}
                className="h-10 px-4 rounded-md border border-input bg-transparent text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
              >
                Go Back
              </button>
              <button
                onClick={() => handleCreateOrg(false)}
                disabled={!formData.bostaEmail || isSubmitting}
                className="h-10 flex-1 rounded-md bg-red-600 border border-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Continue with Bosta
              </button>
            </div>
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => handleCreateOrg(true)}
                disabled={isSubmitting}
                className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors disabled:opacity-50"
              >
                Skip for now
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Import Historical Data</h1>
            <p className="text-sm text-muted-foreground mt-2">Bring in your old transactions via Excel or CSV.</p>
          </div>
          <div className="flex justify-center border rounded-lg p-8 bg-zinc-50">
            {createdOrgSlug && (
              <PlanProvider plan={createdOrgPlan}>
                <UnifiedImportModal orgSlug={createdOrgSlug} />
              </PlanProvider>
            )}
          </div>
          <div className="flex justify-between gap-3 pt-2">
            <button onClick={handleNext} className="h-10 flex-1 rounded-md bg-zinc-900 text-white font-medium hover:bg-zinc-800 transition-colors">
              Continue to First Drop
            </button>
          </div>
        </div>
      )}

      {step === 6 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Your First Drop</h1>
            <p className="text-sm text-muted-foreground mt-2">What collection or items are you tracking right now?</p>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Drop Name</label>
              <input
                type="text" autoFocus placeholder="e.g. Summer 2026 Collection"
                value={formData.firstDropName}
                onChange={(e) => setFormData({ ...formData, firstDropName: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Start Date</label>
                <input
                  type="date"
                  value={formData.firstDropStartDate}
                  onChange={(e) => setFormData({ ...formData, firstDropStartDate: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">End Date</label>
                <input
                  type="date"
                  value={formData.firstDropEndDate}
                  min={formData.firstDropStartDate}
                  onChange={(e) => setFormData({ ...formData, firstDropEndDate: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description (Optional)</label>
              <textarea
                value={formData.firstDropDescription}
                onChange={(e) => setFormData({ ...formData, firstDropDescription: e.target.value })}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Track ROI for new summer collection..."
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => router.push(`/${createdOrgSlug}`)}
              disabled={isSubmitting}
              className="h-10 px-4 rounded-md border border-input bg-transparent text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
            >
              Skip
            </button>
            <button
              onClick={handleFinishDrop}
              disabled={isSubmitting || !formData.firstDropName || !formData.firstDropStartDate || !formData.firstDropEndDate || formData.firstDropEndDate < formData.firstDropStartDate}
              className="h-10 flex-1 rounded-md bg-primary text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Completing...</> : "Complete Setup"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
