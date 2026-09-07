"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Camera, CameraOff, Check, Lock, Mic, MicOff, Shield, Video, Volume2 } from "lucide-react";
import Avatar from "@/components/common/Avatar";
import type { RoomDetails } from "@/types";
import type { LocalMediaApi } from "@/hooks/useLocalMedia";
import { formatDateTime } from "@/lib/utils";

export interface LobbyProps {
  room: RoomDetails;
  media: LocalMediaApi;
  defaultName: string;
  onJoin: (options: { displayName: string; passcode?: string }) => void;
  joining: boolean;
  error: string | null;
}

export default function Lobby({ room, media, defaultName, onJoin, joining, error }: LobbyProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [displayName, setDisplayName] = useState(defaultName);
  const [passcode, setPasscode] = useState("");

  useEffect(() => {
    void media.startPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (videoRef.current && media.localStream) {
      videoRef.current.srcObject = media.localStream;
    }
  }, [media.localStream]);

  const hasVideoTrack = (media.localStream?.getVideoTracks().length ?? 0) > 0;
  const showPreview = hasVideoTrack && media.cameraEnabled;
  const canJoin = displayName.trim().length > 0 && (!room.has_passcode || passcode.length > 0);

  return (
    <div className="flex min-h-screen flex-col bg-[#121214] text-white">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-xs font-medium text-white/60 transition hover:text-white"
        >
          <ArrowLeft size={14} /> Back to dashboard
        </Link>
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-medium text-white/70">
            {room.status === "ACTIVE" ? "Meeting in progress" : "Ready to join"}
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex flex-1 items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-4xl">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-bold tracking-tight text-white/95 md:text-2xl">
              {room.title}
            </h1>
            <p className="mt-1 text-xs text-white/50">
              Hosted by <span className="text-white/80 font-medium">{room.host.name}</span>
              {room.scheduled_for ? ` · ${formatDateTime(room.scheduled_for)}` : ""}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-[1fr_360px] items-start">
            {/* Video Preview Card */}
            <div className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1c1c20] shadow-2xl">
              <div className="relative aspect-video w-full bg-[#0a0a0c]">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full -scale-x-100 object-cover"
                />

                {!showPreview && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#16161a] p-6 text-center">
                    <Avatar name={displayName || "You"} size="lg" />
                    <div className="mt-1">
                      <p className="text-sm font-medium text-white/80">
                        {displayName || "You"}
                      </p>
                      <p className="mt-1 text-xs text-white/40">
                        {media.cameraEnabled
                          ? media.mediaError === "camera-denied"
                            ? "Camera access was denied"
                            : media.mediaError === "media-denied"
                              ? "Permissions denied — you can still join to view and chat"
                              : "Starting camera…"
                          : "Camera is off"}
                      </p>
                    </div>
                  </div>
                )}

                {/* Floating name tag */}
                <div className="absolute bottom-3 left-3 rounded-lg bg-black/60 px-2.5 py-1 text-xs font-medium text-white/90 backdrop-blur-md">
                  {displayName || "You"}
                </div>
              </div>

              {/* Pre-join Control Bar underneath preview */}
              <div className="flex items-center justify-center gap-6 border-t border-white/5 bg-[#18181c] py-4">
                <button
                  type="button"
                  onClick={() => void media.toggleMic()}
                  className={`flex flex-col items-center gap-1.5 transition ${
                    media.micEnabled ? "text-white hover:text-white/80" : "text-rose-400 hover:text-rose-300"
                  }`}
                  title={media.micEnabled ? "Mute microphone" : "Unmute microphone"}
                >
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-full transition shadow-md ${
                      media.micEnabled
                        ? "bg-[#2b2b32] text-white hover:bg-[#36363e]"
                        : "bg-rose-600/90 text-white hover:bg-rose-600"
                    }`}
                  >
                    {media.micEnabled ? <Mic size={20} /> : <MicOff size={20} />}
                  </div>
                  <span className="text-[11px] font-medium tracking-tight">
                    {media.micEnabled ? "Mute" : "Unmute"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => void media.toggleCamera()}
                  className={`flex flex-col items-center gap-1.5 transition ${
                    media.cameraEnabled ? "text-white hover:text-white/80" : "text-rose-400 hover:text-rose-300"
                  }`}
                  title={media.cameraEnabled ? "Stop video" : "Start video"}
                >
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-full transition shadow-md ${
                      media.cameraEnabled
                        ? "bg-[#2b2b32] text-white hover:bg-[#36363e]"
                        : "bg-rose-600/90 text-white hover:bg-rose-600"
                    }`}
                  >
                    {media.cameraEnabled ? <Video size={20} /> : <CameraOff size={20} />}
                  </div>
                  <span className="text-[11px] font-medium tracking-tight">
                    {media.cameraEnabled ? "Stop Video" : "Start Video"}
                  </span>
                </button>
              </div>
            </div>

            {/* Join Form Card */}
            <div className="flex flex-col rounded-2xl border border-white/10 bg-[#1c1c20] p-6 shadow-2xl">
              <div className="flex items-center gap-2 border-b border-white/10 pb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0e72ed] text-white">
                  <Video size={16} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white/90">Join Video Meeting</p>
                  <p className="text-[11px] text-white/50">Meeting ID: {room.room_code}</p>
                </div>
              </div>

              <form
                className="mt-5 flex flex-1 flex-col gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (canJoin && !joining) {
                    onJoin({ displayName: displayName.trim(), passcode: passcode || undefined });
                  }
                }}
              >
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-white/70">
                    Your Name <span className="text-rose-400">*</span>
                  </span>
                  <input
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    maxLength={50}
                    placeholder="Enter your name"
                    className="w-full rounded-xl border border-white/15 bg-[#25252a] px-3.5 py-2.5 text-xs text-white placeholder-white/35 outline-none transition focus:border-[#0e72ed] focus:ring-1 focus:ring-[#0e72ed]"
                  />
                </label>

                {room.has_passcode && (
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-1 text-xs font-medium text-white/70">
                      <Lock size={12} className="text-amber-400" />
                      Meeting Passcode <span className="text-rose-400">*</span>
                    </span>
                    <input
                      type="password"
                      value={passcode}
                      onChange={(event) => setPasscode(event.target.value)}
                      maxLength={12}
                      placeholder="Enter the meeting passcode"
                      className="w-full rounded-xl border border-white/15 bg-[#25252a] px-3.5 py-2.5 text-xs text-white placeholder-white/35 outline-none transition focus:border-[#0e72ed] focus:ring-1 focus:ring-[#0e72ed]"
                    />
                  </label>
                )}

                {media.mediaError && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300/90 leading-relaxed">
                    {media.mediaError === "screen-denied"
                      ? "Screen share permission was cancelled."
                      : "Microphone or camera permission was not granted. You can still join to listen, view, and chat."}
                  </div>
                )}

                {error && (
                  <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
                    {error}
                  </div>
                )}

                <div className="mt-2 space-y-2">
                  <button
                    type="submit"
                    disabled={!canJoin || joining}
                    className="w-full rounded-xl bg-[#0e72ed] py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-[#1a7cf7] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                  >
                    {joining ? "Joining…" : "Join meeting"}
                  </button>

                  <p className="text-center text-[11px] text-white/40">
                    Direct end-to-end peer encrypted via native WebRTC mesh.
                  </p>
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
