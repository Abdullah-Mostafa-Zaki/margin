"use client";

import { Alert } from "@/app/actions/getAlerts";
import { useState, useEffect } from "react";
import { AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { FadeIn } from "@/components/ui/fade-in";

export function AlertsBanner({ alerts }: { alerts: Alert[] }) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Load dismissed alerts from localStorage on mount
    const saved = localStorage.getItem("dismissedAlerts");
    if (saved) {
      try {
        setDismissedIds(new Set(JSON.parse(saved)));
      } catch (e) {
        console.error("Failed to parse dismissed alerts", e);
      }
    }
    setMounted(true);
  }, []);

  if (!mounted || alerts.length === 0) return null;

  const visibleAlerts = alerts.filter(a => !dismissedIds.has(a.id));

  if (visibleAlerts.length === 0) return null;

  const handleDismiss = (id: string) => {
    const newDismissed = new Set(dismissedIds);
    newDismissed.add(id);
    setDismissedIds(newDismissed);
    localStorage.setItem("dismissedAlerts", JSON.stringify(Array.from(newDismissed)));
  };

  return (
    <div className="space-y-3 mb-6">
      {visibleAlerts.map((alert, i) => {
        const isCritical = alert.severity === "critical";
        const isWarning = alert.severity === "warning";
        
        return (
          <FadeIn key={alert.id} delay={i * 0.1}>
            <div className={`relative flex items-start gap-3 p-4 rounded-xl border shadow-sm transition-all duration-300 ${
              isCritical ? 'bg-rose-50 border-rose-200' :
              isWarning ? 'bg-amber-50 border-amber-200' :
              'bg-blue-50 border-blue-200'
            }`}>
              <div className="mt-0.5 shrink-0">
                {isCritical ? <AlertCircle className="w-5 h-5 text-rose-600" /> :
                 isWarning ? <AlertTriangle className="w-5 h-5 text-amber-600" /> :
                 <Info className="w-5 h-5 text-blue-600" />}
              </div>
              <div className="flex-1">
                <h4 className={`text-sm font-semibold flex items-center gap-2 ${
                  isCritical ? 'text-rose-900' :
                  isWarning ? 'text-amber-900' :
                  'text-blue-900'
                }`}>
                  {alert.title}
                  {alert.metric && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold ${
                      isCritical ? 'bg-rose-200 text-rose-800' :
                      isWarning ? 'bg-amber-200 text-amber-800' :
                      'bg-blue-200 text-blue-800'
                    }`}>
                      {alert.metric}
                    </span>
                  )}
                </h4>
                <p className={`text-sm mt-1 leading-relaxed ${
                  isCritical ? 'text-rose-700' :
                  isWarning ? 'text-amber-700' :
                  'text-blue-700'
                }`}>
                  {alert.message}
                </p>
              </div>
              <button 
                onClick={() => handleDismiss(alert.id)}
                className={`p-1.5 rounded-md opacity-70 hover:opacity-100 transition-all shrink-0 ${
                  isCritical ? 'hover:bg-rose-200 text-rose-900' :
                  isWarning ? 'hover:bg-amber-200 text-amber-900' :
                  'hover:bg-blue-200 text-blue-900'
                }`}
                aria-label="Dismiss alert"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </FadeIn>
        );
      })}
    </div>
  );
}
