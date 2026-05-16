"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, Paperclip, Send } from "lucide-react";
import { ChatMessage } from "./types";
import {
  parseTextTransaction,
  parseVoiceTransaction,
  parseReceiptFromImage,
} from "@/actions/ai.actions";
import TransactionForm from "@/components/transactions/transaction-form";
import { useUploadThing } from "@/lib/uploadthing";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";

// ─────────────────────────────────────────────────────────────────────────────

const welcomeMessage: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content: "Hey! Log a transaction using voice, a receipt photo, or just type.",
  timestamp: new Date(),
};

// ─────────────────────────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex flex-col items-start w-full">
      <div className="flex w-fit max-w-[80%] rounded-2xl px-4 py-3 bg-muted text-foreground items-center gap-1">
        <div className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }} />
        <div className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "150ms" }} />
        <div className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} w-full`}>
      <div
        className={`flex flex-col gap-2 max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
          isUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
        }`}
      >
        {message.attachment?.type === "image" && message.attachment.previewUrl && (
          <img
            src={message.attachment.previewUrl}
            alt="Attachment"
            className="rounded-lg max-h-48 object-cover"
          />
        )}
        {message.attachment?.type === "audio" && (
          <div className="flex items-center gap-2 bg-black/10 dark:bg-white/10 rounded p-2 w-fit">
            <Mic className="w-4 h-4" />
            <span className="text-xs font-medium">Voice note</span>
          </div>
        )}
        <div className="whitespace-pre-wrap leading-relaxed">{message.content}</div>
      </div>
      <span className="text-[10px] text-muted-foreground mt-1 mx-1 min-h-4">
        {mounted
          ? message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : ""}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function ChatHome({ orgSlug }: { orgSlug: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);
  const [inputText, setInputText]     = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<any | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef    = useRef<HTMLDivElement>(null);

  // ── Audio recorder hook (handles iOS MIME, base64, stream release) ──────────
  const {
    isRecording,
    base64Audio,
    mimeType:  recordedMimeType,
    startRecording,
    stopRecording,
    error: recorderError,
  } = useAudioRecorder();

  const { startUpload } = useUploadThing("receiptUploader");

  // ── Auto-scroll on new messages ─────────────────────────────────────────────
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isProcessing]);

  // ── React to completed recording: base64Audio becomes non-null ───────────────
  useEffect(() => {
    if (!base64Audio || !recordedMimeType) return;

    const processRecording = async () => {
      setIsProcessing(true);
      try {
        const result = await parseVoiceTransaction(base64Audio, recordedMimeType);
        if (result.success) {
          setExtractedData(result.data);
        } else {
          appendAssistantMessage(result.error || "Failed to process voice note.");
        }
      } catch (err: any) {
        appendAssistantMessage(err.message || "An error occurred during voice processing.");
      } finally {
        setIsProcessing(false);
      }
    };

    processRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base64Audio, recordedMimeType]);

  // ── Surface recorder errors into the chat stream ────────────────────────────
  useEffect(() => {
    if (recorderError) {
      appendAssistantMessage(`🎤 ${recorderError}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorderError]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Message helpers
  // ─────────────────────────────────────────────────────────────────────────────

  const appendUserMessage = (content: string, attachment?: ChatMessage["attachment"]) => {
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "user",
        content,
        timestamp: new Date(),
        attachment,
      },
    ]);
  };

  const appendAssistantMessage = (content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content,
        timestamp: new Date(),
      },
    ]);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Step 1 — Text submission handler (wired to parseTextTransaction)
  // ─────────────────────────────────────────────────────────────────────────────

  const handleTextSubmit = async () => {
    // Capture BEFORE clearing to avoid state race condition
    const textToSend = inputText.trim();
    if (!textToSend || isProcessing) return;

    appendUserMessage(textToSend);
    setInputText("");
    setIsProcessing(true);

    try {
      const result = await parseTextTransaction(textToSend);
      if (result.success) {
        setExtractedData(result.data);
      } else {
        appendAssistantMessage(result.error || "Couldn't parse that. Please try again.");
      }
    } catch (err: any) {
      appendAssistantMessage(err.message || "An error occurred. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Step 2 — Voice handler (delegates entirely to useAudioRecorder hook)
  // ─────────────────────────────────────────────────────────────────────────────

  const handleVoiceRecord = async () => {
    if (isRecording) {
      stopRecording();
      // Append the user bubble immediately on stop
      appendUserMessage("🎤 Voice message", { type: "audio" });
    } else {
      await startRecording();
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Image receipt handler
  // ─────────────────────────────────────────────────────────────────────────────

  const handleImageAttach = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    appendUserMessage("📎 Receipt image", { type: "image", previewUrl });

    if (fileInputRef.current) fileInputRef.current.value = "";

    setIsProcessing(true);
    try {
      const res = await startUpload([file]);
      if (res && res.length > 0) {
        const uploadUrl = res[0].ufsUrl || res[0].url;
        const result = await parseReceiptFromImage(uploadUrl);
        if (result && result.length > 0) {
          setExtractedData(result[0]);
        } else {
          appendAssistantMessage("Could not extract any transaction data from the image.");
        }
      }
    } catch (err: any) {
      appendAssistantMessage(err.message || "Failed to upload or parse receipt.");
    } finally {
      setIsProcessing(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] md:h-[calc(100vh-8rem)] w-full relative">

      {/* Scrollable message history */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto w-full">
        <div className="max-w-3xl mx-auto px-4 py-4 pb-32 space-y-4">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {isProcessing && <TypingIndicator />}
        </div>
      </div>

      {/* Outer Floating Wrapper */}
      <div className="fixed bottom-0 left-0 right-0 p-4 pb-6 md:pb-8 z-40 pointer-events-none">
        <div className="max-w-3xl mx-auto pointer-events-auto">

          {/* The Unified Input Pill */}
          <div className="flex items-center gap-2 bg-muted/40 border border-border/50 rounded-3xl px-2 py-1.5 shadow-sm focus-within:ring-1 focus-within:ring-ring transition-all">

            {/* 1. Attachment Button (Left) */}
            <button
              type="button"
              onClick={handleImageAttach}
              disabled={isProcessing}
              className="flex-shrink-0 p-2 text-muted-foreground hover:bg-muted hover:text-foreground rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            {/* 2. Transparent Input (Center) */}
            <input
              className="flex-1 bg-transparent border-none outline-none focus:ring-0 px-2 py-1.5 min-w-0"
              placeholder="Type here..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleTextSubmit();
                }
              }}
              disabled={isProcessing}
            />

            {/* 3. Mic Button (Right) */}
            <button
              type="button"
              onClick={handleVoiceRecord}
              disabled={isProcessing && !isRecording}
              className={`flex-shrink-0 p-2 rounded-full transition-colors ${
                isRecording
                  ? "bg-red-500 text-white animate-pulse"
                  : "text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
              }`}
            >
              <Mic className="w-5 h-5" />
            </button>

            {/* 4. Send Button (Right) */}
            <button
              type="button"
              onClick={handleTextSubmit}
              disabled={!inputText.trim() || isProcessing}
              className="flex-shrink-0 p-2 bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 rounded-full transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

        </div>
      </div>

      {/* Step 3 — Human-in-the-Loop Form Overlay + Conversational Success Bubble */}
      {extractedData && (
        <TransactionForm
          orgSlug={orgSlug}
          prefillData={extractedData}
          onSuccessCallback={(data) => {
            setExtractedData(null);
            appendAssistantMessage(
              `✓ Logged EGP ${data.amount} for ${data.category} via ${data.paymentMethod}.`
            );
          }}
          onCancelCallback={() => {
            setExtractedData(null);
          }}
        />
      )}
    </div>
  );
}
