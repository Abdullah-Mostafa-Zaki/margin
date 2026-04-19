"use client";

import { useState, useRef, useCallback } from "react";

interface AudioRecorderResult {
  isRecording: boolean;
  base64Audio: string | null;
  mimeType: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  error: string | null;
}

/**
 * Cross-browser audio recorder hook.
 * Handles WebM (Chrome/Firefox) and MP4 (Safari/iOS) MIME negotiation,
 * converts the recorded Blob to a base64 string for API transport.
 *
 * iOS Safari fixes:
 * - Prioritizes audio/mp4 for Safari (which may report video/mp4 for audio-only)
 * - Resumes a suspended AudioContext to unlock the mic on iOS
 * - Filters out 0-byte chunks that Safari sometimes emits
 */
export function useAudioRecorder(): AudioRecorderResult {
  const [isRecording, setIsRecording] = useState(false);
  const [base64Audio, setBase64Audio] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  /**
   * Detects if we're on iOS/Safari.
   */
  const isIOSSafari = (): boolean => {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent;
    return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
  };

  /**
   * Determines the best supported MIME type for the current browser.
   * On iOS/Safari, we prioritize audio/mp4 since Safari doesn't support webm
   * and sometimes reports video/mp4 for audio-only recordings.
   */
  const getSupportedMimeType = (): string => {
    // iOS/Safari priority — check mp4 first
    if (isIOSSafari()) {
      const safariCandidates = [
        "audio/mp4",
        "audio/aac",
        "audio/webm",
      ];
      for (const candidate of safariCandidates) {
        if (MediaRecorder.isTypeSupported(candidate)) {
          return candidate;
        }
      }
      // Safari fallback — let browser pick, we'll normalize the MIME later
      return "";
    }

    // Non-Safari priority
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg;codecs=opus",
      "audio/ogg",
    ];
    for (const candidate of candidates) {
      if (MediaRecorder.isTypeSupported(candidate)) {
        return candidate;
      }
    }
    // Last resort — let the browser pick
    return "";
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        // Strip the data URL prefix (e.g. "data:audio/webm;base64,")
        const base64 = dataUrl.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const startRecording = useCallback(async () => {
    setError(null);
    setBase64Audio(null);
    setMimeType(null);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // iOS Safari: Resume AudioContext if suspended (required to "unlock" the mic)
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          if (ctx.state === "suspended") {
            await ctx.resume();
          }
          // Connect the stream to the context to ensure iOS processes it
          ctx.createMediaStreamSource(stream);
        }
      } catch {
        // AudioContext not critical — continue without it
      }

      const detectedMime = getSupportedMimeType();

      const recorder = detectedMime
        ? new MediaRecorder(stream, { mimeType: detectedMime })
        : new MediaRecorder(stream);

      // Store the actual mimeType the recorder is using
      const activeMime = recorder.mimeType || detectedMime || "audio/mp4";

      recorder.ondataavailable = (e) => {
        // Filter out 0-byte chunks (iOS Safari sometimes emits empty first chunks)
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        // Stop all tracks to release the microphone
        stream.getTracks().forEach((track) => track.stop());

        if (chunksRef.current.length === 0) {
          setError("Recording was empty. Please try again and speak clearly.");
          return;
        }

        const blob = new Blob(chunksRef.current, { type: activeMime });

        if (blob.size < 100) {
          setError("Recording was too short. Please try again.");
          return;
        }

        try {
          const b64 = await blobToBase64(blob);
          setBase64Audio(b64);
          // Normalize MIME: strip codecs param and fix video/mp4 → audio/mp4
          let normalizedMime = activeMime.split(";")[0];
          if (normalizedMime === "video/mp4") {
            normalizedMime = "audio/mp4";
          }
          setMimeType(normalizedMime);
        } catch {
          setError("Failed to process audio recording.");
        }
      };

      mediaRecorderRef.current = recorder;
      // Use timeslice to ensure data is captured periodically (helps iOS)
      recorder.start(1000);
      setIsRecording(true);
    } catch (err: any) {
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setError("Microphone permission denied. Please allow access and try again.");
      } else {
        setError("Could not start recording. Check your microphone.");
      }
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, []);

  return {
    isRecording,
    base64Audio,
    mimeType,
    startRecording,
    stopRecording,
    error,
  };
}
