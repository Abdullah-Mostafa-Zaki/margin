"use client";

import { Alert } from "@/app/actions/getAlerts";
import { useState, useEffect } from "react";
import { AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { FadeIn } from "@/components/ui/fade-in";

export function AlertsBanner({ alerts }: { alerts: Alert[] }) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
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

  const severityOrder = { critical: 0, warning: 1, info: 2 };
  const sortedAlerts = [...alerts].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  const visibleAlerts = sortedAlerts.filter(a => !dismissedIds.has(a.id));

  const topAlert = visibleAlerts[0];
  if (!topAlert) return null;

  const handleDismiss = (id: string) => {
    const newDismissed = new Set(dismissedIds);
    newDismissed.add(id);
    setDismissedIds(newDismissed);
    localStorage.setItem("dismissedAlerts", JSON.stringify(Array.from(newDismissed)));
  };

  const isCritical = topAlert.severity === "critical";
  const isWarning = topAlert.severity === "warning";

  return (
    <div className="mb-4 sm:mb-6">
      <FadeIn delay={0.1}>
        <div className={`flex items-center justify-between gap-2 p-2 sm:px-3 rounded-lg border shadow-sm transition-all duration-300 ${
          isCritical ? 'bg-rose-50 border-rose-200' :
          isWarning ? 'bg-amber-50 border-amber-200' :
          'bg-blue-50 border-blue-200'
        }`}>
          <div className="flex items-center gap-2 overflow-hidden flex-1">
            <div className="shrink-0">
              {isCritical ? <AlertCircle className="w-4 h-4 text-rose-600" /> :
               isWarning ? <AlertTriangle className="w-4 h-4 text-amber-600" /> :
               <Info className="w-4 h-4 text-blue-600" />}
            </div>
            
            <div className="flex items-center gap-2 truncate">
              <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider whitespace-nowrap ${
                isCritical ? 'text-rose-900' :
                isWarning ? 'text-amber-900' :
                'text-blue-900'
              }`}>
                {topAlert.title}
              </span>
              
              {topAlert.metric && (
                <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] uppercase tracking-wider font-bold ${
                  isCritical ? 'bg-rose-200 text-rose-800' :
                  isWarning ? 'bg-amber-200 text-amber-800' :
                  'bg-blue-200 text-blue-800'
                }`}>
                  {topAlert.metric}
                </span>
              )}
              
              <span className={`hidden sm:inline text-xs truncate ml-1 ${
                isCritical ? 'text-rose-700' :
                isWarning ? 'text-amber-700' :
                'text-blue-700'
              }`}>
                — {topAlert.message}
              </span>
            </div>
          </div>

          <button 
            onClick={() => handleDismiss(topAlert.id)}
            className={`p-1 rounded-md opacity-70 hover:opacity-100 transition-all shrink-0 ${
              isCritical ? 'hover:bg-rose-200 text-rose-900' :
              isWarning ? 'hover:bg-amber-200 text-amber-900' :
              'hover:bg-blue-200 text-blue-900'
            }`}
            aria-label="Dismiss alert"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </FadeIn>
    </div>
  );
}
