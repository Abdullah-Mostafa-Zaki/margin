"use client";

import { useState, useEffect } from "react";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { parseVoiceTransaction } from "@/actions/ai.actions";
import { Mic, Loader2 } from "lucide-react";

export interface VoiceTransactionData {
  amount: number;
  type: "INCOME" | "EXPENSE";
  category: string;
  paymentMethod: "CASH" | "CARD" | "COD" | "INSTAPAY";
  date: string;
  notes: string;
}

interface MagicVoiceButtonProps {
  onResult: (data: VoiceTransactionData) => void;
}

/**
 * Standalone Magic Voice button.
 * Records audio → sends to Gemini → returns parsed transaction data via callback.
 */
export function MagicVoiceButton({ onResult }: MagicVoiceButtonProps) {
  const {
    isRecording,
    base64Audio,
    mimeType,
    startRecording,
    stopRecording,
    error: micError,
  } = useAudioRecorder();

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // When recording stops and audio is ready, send to Gemini
  useEffect(() => {
    if (!base64Audio || !mimeType || isProcessing) return;

    setIsProcessing(true);
    setError(null);

    parseVoiceTransaction(base64Audio, mimeType)
      .then((result) => {
        if (result.success) {
          onResult(result.data);
        } else {
          setError(result.error);
        }
      })
      .catch((err: any) => {
        // Fallback: unexpected client-side failure (e.g. network error)
        setError(err.message || "Voice processing failed. Please try again.");
      })
      .finally(() => {
        setIsProcessing(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base64Audio, mimeType]);

  const handleToggle = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      setError(null);
      await startRecording();
    }
  };

  const displayError = micError || error;

  return (
    <div className="relative">
      {/* Desktop button */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={isProcessing}
        className={`hidden md:inline-flex items-center justify-center gap-2 h-10 rounded-md border px-4 text-sm font-medium transition-all duration-200 ${
          isProcessing
            ? "border-[#27A67A]/20 bg-[#27A67A]/5 text-[#27A67A]/40 cursor-wait"
            : isRecording
              ? "border-red-300 bg-red-500 text-white shadow-lg shadow-red-200 animate-pulse"
              : "border-[#27A67A]/20 bg-[#27A67A]/10 text-[#27A67A] hover:bg-[#27A67A]/20 hover:border-[#27A67A]/30 active:scale-95"
        }`}
        title={isRecording ? "Stop recording" : "Magic Fill — speak your transaction"}
      >
        {isProcessing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
        {isRecording ? "Stop" : isProcessing ? "Processing…" : "Voice"}
      </button>

      {/* Mobile FAB — positioned to the left of the Add Transaction FAB */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={isProcessing}
        className={`md:hidden flex items-center justify-center fixed right-24 bottom-[calc(1.5rem+env(safe-area-inset-bottom))] h-14 w-14 rounded-full shadow-lg transition-all duration-200 z-50 ${
          isProcessing
            ? "bg-[#27A67A]/10 text-[#27A67A]/40 cursor-wait"
            : isRecording
              ? "bg-red-500 text-white shadow-red-300 animate-pulse"
              : "bg-[#27A67A]/10 text-[#27A67A] active:scale-95"
        }`}
        aria-label={isRecording ? "Stop recording" : "Voice input"}
      >
        {isProcessing ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : (
          <Mic className="h-6 w-6" />
        )}
      </button>

      {/* Error tooltip */}
      {displayError && (
        <div className="absolute top-full mt-2 right-0 z-50 max-w-xs rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 shadow-lg whitespace-normal">
          {displayError}
        </div>
      )}
    </div>
  );
}
