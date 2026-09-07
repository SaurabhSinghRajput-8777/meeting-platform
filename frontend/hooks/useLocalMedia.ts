"use client";

import { useCallback, useRef, useState } from "react";

export type MediaErrorCode =
  | "camera-denied"
  | "mic-denied"
  | "media-denied"
  | "screen-denied"
  | null;

export interface LocalMediaApi {
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  cameraEnabled: boolean;
  micEnabled: boolean;
  isScreenSharing: boolean;
  mediaError: MediaErrorCode;
  startPreview: () => Promise<void>;
  toggleCamera: () => Promise<void>;
  toggleMic: () => Promise<void>;
  forceMute: () => void;
  startScreenShare: () => Promise<boolean>;
  stopScreenShare: () => void;
  release: () => void;
}

function errorMessage(error: unknown): MediaErrorCode {
  const name = (error as DOMException)?.name;
  if (name === "NotAllowedError" || name === "SecurityError") return "media-denied";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "media-denied";
  return "media-denied";
}

/**
 * Owns all local media (getUserMedia / getDisplayMedia) and the local
 * enabled/disabled state. Mute/unmute controls the audio track's `enabled`
 * flag; camera toggle controls the video track's `enabled` flag (PRD §25/§26).
 */
export function useLocalMedia(): LocalMediaApi {
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [mediaError, setMediaError] = useState<MediaErrorCode>(null);

  const startPreview = useCallback(async () => {
    if (localStreamRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setCameraEnabled(stream.getVideoTracks().length > 0);
      setMicEnabled(stream.getAudioTracks().length > 0);
      setMediaError(null);
    } catch (error) {
      // Camera may be denied/unavailable — still try to join with the mic.
      try {
        const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = audioOnly;
        setLocalStream(audioOnly);
        setCameraEnabled(false);
        setMicEnabled(true);
        setMediaError("camera-denied");
      } catch {
        setMediaError(errorMessage(error));
      }
    }
  }, []);

  const toggleMic = useCallback(async () => {
    const liveTrack = localStreamRef.current
      ?.getAudioTracks()
      .find((t) => t.readyState === "live");
    if (liveTrack) {
      liveTrack.enabled = !liveTrack.enabled;
      setMicEnabled(liveTrack.enabled);
      return;
    }
    // No live audio track yet (joined muted, unprompted on mobile, or track ended):
    // Acquire a new audio track with user gesture.
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      const newTrack = stream.getAudioTracks()[0];
      if (!newTrack) {
        setMediaError("mic-denied");
        return;
      }
      newTrack.enabled = true;
      const currentLiveTracks = (localStreamRef.current?.getTracks() ?? []).filter(
        (t) => t.kind !== "audio" && t.readyState === "live",
      );
      const combined = new MediaStream([...currentLiveTracks, newTrack]);
      localStreamRef.current = combined;
      setLocalStream(combined);
      setMicEnabled(true);
      setMediaError(null);
    } catch (err) {
      console.warn("Could not acquire microphone track:", err);
      setMediaError("mic-denied");
    }
  }, []);

  const toggleCamera = useCallback(async () => {
    const liveTrack = localStreamRef.current
      ?.getVideoTracks()
      .find((t) => t.readyState === "live");
    if (liveTrack) {
      liveTrack.enabled = !liveTrack.enabled;
      setCameraEnabled(liveTrack.enabled);
      return;
    }
    // No live video track yet: acquire one on demand.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const newTrack = stream.getVideoTracks()[0];
      if (!newTrack) {
        setMediaError("camera-denied");
        return;
      }
      newTrack.enabled = true;
      const currentLiveTracks = (localStreamRef.current?.getTracks() ?? []).filter(
        (t) => t.kind !== "video" && t.readyState === "live",
      );
      const combined = new MediaStream([...currentLiveTracks, newTrack]);
      localStreamRef.current = combined;
      setLocalStream(combined);
      setCameraEnabled(true);
      setMediaError(null);
    } catch {
      setMediaError("camera-denied");
    }
  }, []);

  const forceMute = useCallback(() => {
    const tracks = localStreamRef.current?.getAudioTracks() ?? [];
    for (const track of tracks) {
      track.enabled = false;
    }
    setMicEnabled(false);
  }, []);

  const stopScreenShare = useCallback(() => {
    const stream = screenStreamRef.current;
    if (!stream) return;
    stream.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    screenStreamRef.current = null;
    setScreenStream(null);
    setIsScreenSharing(false);
  }, []);

  const startScreenShare = useCallback(async () => {
    if (screenStreamRef.current) return true;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      screenStreamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      // The browser's "Stop sharing" bar must also stop our sharing state.
      track.onended = () => stopScreenShare();
      setScreenStream(stream);
      setIsScreenSharing(true);
      return true;
    } catch {
      setMediaError("screen-denied");
      return false;
    }
  }, [stopScreenShare]);

  const release = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    screenStreamRef.current?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    screenStreamRef.current = null;
    setLocalStream(null);
    setScreenStream(null);
    setCameraEnabled(false);
    setMicEnabled(false);
    setIsScreenSharing(false);
  }, []);

  return {
    localStream,
    screenStream,
    cameraEnabled,
    micEnabled,
    isScreenSharing,
    mediaError,
    startPreview,
    toggleCamera,
    toggleMic,
    forceMute,
    startScreenShare,
    stopScreenShare,
    release,
  };
}
