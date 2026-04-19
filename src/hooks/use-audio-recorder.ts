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
 */
export function useAudioRecorder(): AudioRecorderResult {
  const [isRecording, setIsRecording] = useState(false);
  const [base64Audio, setBase64Audio] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  /**
   * Determines the best supported MIME type for the current browser.
   * Safari/iOS doesn't support audio/webm, so we fall back to audio/mp4.
   */
  const getSupportedMimeType = (): string => {
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
      const detectedMime = getSupportedMimeType();

      const recorder = detectedMime
        ? new MediaRecorder(stream, { mimeType: detectedMime })
        : new MediaRecorder(stream);

      // Store the actual mimeType the recorder is using
      const activeMime = recorder.mimeType || detectedMime || "audio/webm";

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        // Stop all tracks to release the microphone
        stream.getTracks().forEach((track) => track.stop());

        const blob = new Blob(chunksRef.current, { type: activeMime });
        try {
          const b64 = await blobToBase64(blob);
          setBase64Audio(b64);
          // Normalize to a simple MIME (strip codecs param for the API)
          setMimeType(activeMime.split(";")[0]);
        } catch {
          setError("Failed to process audio recording.");
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
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
