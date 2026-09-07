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
      className={`group relative flex min-h-0 items-center justify-center overflow-hidden rounded-2xl bg-[#18181c] border border-white/[0.06] transition-all duration-200 ${
        isSpeaking
          ? "ring-[2.5px] ring-emerald-500 shadow-[0_0_24px_rgba(16,185,129,0.3)] z-10"
          : "hover:border-white/10"
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

      {/* Avatar fallback when video is stopped/unavailable */}
      {!showVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#18181c]">
          <Avatar name={displayName} size={compact ? "md" : "xl"} />
          {!compact && (
            <span className="text-xs font-medium text-zinc-400">
              {displayName}
            </span>
          )}
        </div>
      )}

      {/* Screen sharing pill indicator */}
      {isScreenSharing && (
        <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-md bg-emerald-500/20 backdrop-blur-md border border-emerald-500/30 px-2.5 py-1 text-[11px] font-medium text-emerald-400 shadow-md">
          <MonitorUp size={13} />
          <span>Sharing screen</span>
        </div>
      )}

      {/* Floating Bottom-Left Zoom-style Name Tag */}
      <div className="absolute bottom-2.5 left-2.5 flex max-w-[85%] items-center gap-1.5 rounded-md bg-black/60 backdrop-blur-md px-2.5 py-1 text-xs font-medium text-white shadow-md border border-white/10">
        {isMuted && (
          <span title="Muted" className="flex items-center">
            <MicOff
              size={compact ? 12 : 13}
              className="shrink-0 text-red-500"
            />
          </span>
        )}
        {isHost && (
          <span title="Host" className="flex items-center">
            <Crown
              size={compact ? 11 : 12}
              className="shrink-0 text-amber-400"
            />
          </span>
        )}
        <span
          className={`truncate font-medium text-white/95 ${
            compact ? "text-[11px]" : "text-xs"
          }`}
        >
          {nameLabel}
        </span>
      </div>
    </div>
  );
}
