"use client";

import { useEffect, useRef, useState } from "react";
import { MicOff, MonitorUp, Crown } from "lucide-react";
import Avatar from "@/components/common/Avatar";

export interface VideoTileProps {
  stream: MediaStream | null;
  displayName: string;
  isSelf: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isHost: boolean;
  isSpeaking: boolean;
  compact?: boolean;
}

export default function VideoTile({
  stream,
  displayName,
  isSelf,
  isMuted,
  isVideoOff,
  isScreenSharing,
  isHost,
  isSpeaking,
  compact = false,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [, setTrackVersion] = useState<number>(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }
    void video.play().catch(() => undefined);

    const onTrackChange = () => {
      setTrackVersion((v: number) => v + 1);
      if (video.srcObject !== stream) {
        video.srcObject = stream;
      }
      void video.play().catch(() => undefined);
    };

    stream.addEventListener("addtrack", onTrackChange);
    stream.addEventListener("removetrack", onTrackChange);
    return () => {
      stream.removeEventListener("addtrack", onTrackChange);
      stream.removeEventListener("removetrack", onTrackChange);
    };
  }, [stream]);

  const showVideo = stream !== null && !isVideoOff && stream.getVideoTracks().length > 0;
  const nameLabel = `${displayName}${isSelf ? " (You)" : ""}`;

  return (
    <div
      className={`relative flex min-h-0 items-center justify-center overflow-hidden rounded-xl bg-surface-2 transition ${
        isSpeaking ? "ring-2 ring-success" : ""
      }`}
      data-tile={displayName}
      data-self={isSelf}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted /* audio is played through dedicated hidden audio elements */
        className={`h-full w-full ${isScreenSharing ? "object-contain" : "object-cover"} ${
          isSelf && !isScreenSharing ? "-scale-x-100" : ""
        }`}
      />
      {!showVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <Avatar name={displayName} size={compact ? "sm" : "lg"} />
        </div>
      )}

      {/* Name + status bar */}
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/70 to-transparent px-2.5 py-2">
        {isMuted && <MicOff size={compact ? 12 : 14} className="shrink-0 text-danger" />}
        {isScreenSharing && <MonitorUp size={compact ? 12 : 14} className="shrink-0 text-accent" />}
        {isHost && <Crown size={compact ? 12 : 14} className="shrink-0 text-warning" />}
        <span
          className={`truncate font-medium text-white drop-shadow ${compact ? "text-xs" : "text-sm"}`}
        >
          {nameLabel}
        </span>
        {isScreenSharing && (
          <span className="ml-auto hidden rounded bg-accent/25 px-1.5 py-0.5 text-[10px] font-medium text-accent sm:block">
            Sharing screen
          </span>
        )}
      </div>
    </div>
  );
}
