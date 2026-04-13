"use client";

import { useState } from "react";
import { completeOnboarding } from "@/actions/onboarding.actions";
import { Loader2 } from "lucide-react";

export function OnboardingWizard() {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    brandName: "",
    courierFee: 45,
    startingCapital: 0,
    shopifyWebhookUrl: "",
    shopifySecretKey: "",
    firstDropName: "",
  });

  const handleNext = () => setStep((s) => s + 1);
  const handleBack = () => setStep((s) => s - 1);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await completeOnboarding(formData);
    } catch (error) {
      console.error(error);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-sm">
      {/* Progress Bar */}
      <div className="mb-8 flex gap-2">
        {[1, 2, 3, 4].map((i) => (
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
              <label className="text-sm font-medium">Standard Courier Fee (EGP)</label>
              <input 
                type="number" min="0" value={formData.courierFee}
                onChange={(e) => setFormData({ ...formData, courierFee: Number(e.target.value) })}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Starting Capital (EGP)</label>
              <p className="text-xs text-muted-foreground mb-1">Seed your dashboard with initial cash.</p>
              <input 
                type="number" min="0" value={formData.startingCapital}
                onChange={(e) => setFormData({ ...formData, startingCapital: Number(e.target.value) })}
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
          
          <div className="aspect-video w-full overflow-hidden rounded-xl bg-zinc-100 border relative">
            <video 
              autoPlay 
              loop 
              muted 
              playsInline 
              src="/shopify-tutorial.mp4" 
              className="object-cover w-full h-full"
            />
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Shopify Webhook URL</label>
              <input 
                type="text" placeholder="https://..."
                value={formData.shopifyWebhookUrl}
                onChange={(e) => setFormData({ ...formData, shopifyWebhookUrl: e.target.value })}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Shopify Secret Key</label>
              <input 
                type="text" placeholder="whsec_..."
                value={formData.shopifySecretKey}
                onChange={(e) => setFormData({ ...formData, shopifySecretKey: e.target.value })}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <div className="flex gap-3">
              <button 
                onClick={handleNext} 
                className="h-10 flex-1 rounded-md bg-zinc-900 border border-zinc-900 text-white font-medium hover:bg-zinc-800 transition-colors"
              >
                Connect Store
              </button>
              <button 
                onClick={handleNext} 
                className="h-10 flex-1 rounded-md border border-input bg-transparent text-sm font-medium hover:bg-muted"
              >
                Skip for now
              </button>
            </div>
            <button onClick={handleBack} className="text-sm text-muted-foreground hover:underline text-center">
              Go Back
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Your First Drop</h1>
            <p className="text-sm text-muted-foreground mt-2">What collection or items are you tracking right now?</p>
          </div>
          <input 
            type="text" autoFocus placeholder="e.g. Summer 2026 Collection"
            value={formData.firstDropName}
            onChange={(e) => setFormData({ ...formData, firstDropName: e.target.value })}
            className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-center"
          />
          <div className="flex gap-3">
            <button onClick={handleBack} disabled={isSubmitting} className="h-10 px-4 rounded-md border disabled:opacity-50">Back</button>
            <button 
              onClick={handleSubmit} disabled={isSubmitting}
              className="h-10 flex-1 rounded-md bg-primary text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin"/> Creating Brand...</> : "Complete Setup"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
