"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Camera, CameraOff, Mic, MicOff, Video } from "lucide-react";
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
    <div className="flex min-h-screen items-center justify-center bg-bg p-4">
      <div className="w-full max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-muted transition hover:text-white"
          >
            <ArrowLeft size={16} /> Back to dashboard
          </Link>
          <span className="rounded-md bg-surface px-3 py-1 text-xs font-medium text-muted">
            {room.status === "ACTIVE" ? "Meeting in progress" : "Ready to join"}
          </span>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* Preview */}
          <div className="overflow-hidden rounded-2xl bg-surface">
            <div className="relative aspect-video bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full -scale-x-100 object-cover"
              />
              {!showPreview && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted">
                  <Avatar name={displayName || "You"} size="lg" />
                  <p className="text-sm">
                    {media.cameraEnabled
                      ? media.mediaError === "camera-denied"
                        ? "Camera unavailable — you can join with your camera off"
                        : media.mediaError === "media-denied"
                          ? "Camera and microphone access denied. You can still join to view and chat."
                          : "Starting camera…"
                      : "Your camera is off"}
                  </p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-center gap-4 p-4">
              <button
                type="button"
                onClick={() => void media.toggleMic()}
                className={`flex h-12 w-12 items-center justify-center rounded-full transition ${
                  media.micEnabled
                    ? "bg-surface-3 text-white hover:bg-line"
                    : "bg-danger text-white hover:bg-danger-hover"
                }`}
                title={media.micEnabled ? "Turn off microphone" : "Turn on microphone"}
              >
                {media.micEnabled ? <Mic size={20} /> : <MicOff size={20} />}
              </button>
              <button
                type="button"
                onClick={() => void media.toggleCamera()}
                className={`flex h-12 w-12 items-center justify-center rounded-full transition ${
                  media.cameraEnabled
                    ? "bg-surface-3 text-white hover:bg-line"
                    : "bg-danger text-white hover:bg-danger-hover"
                }`}
                title={media.cameraEnabled ? "Turn off camera" : "Turn on camera"}
              >
                {media.cameraEnabled ? <Video size={20} /> : <CameraOff size={20} />}
              </button>
            </div>
          </div>

          {/* Join card */}
          <div className="flex flex-col rounded-2xl bg-surface p-6">
            <h1 className="text-lg font-semibold">{room.title}</h1>
            <p className="mt-1 text-sm text-muted">
              Hosted by {room.host.name}
              {room.scheduled_for ? ` · ${formatDateTime(room.scheduled_for)}` : ""}
            </p>

            <form
              className="mt-6 flex flex-1 flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (canJoin && !joining) {
                  onJoin({ displayName: displayName.trim(), passcode: passcode || undefined });
                }
              }}
            >
              <label className="block">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
                  Your name
                </span>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  maxLength={50}
                  placeholder="Enter your name"
                  className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-sm outline-none transition focus:border-accent"
                />
              </label>

              {room.has_passcode && (
                <label className="block">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
                    Passcode
                  </span>
                  <input
                    type="password"
                    value={passcode}
                    onChange={(event) => setPasscode(event.target.value)}
                    maxLength={12}
                    placeholder="Enter the meeting passcode"
                    className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-sm outline-none transition focus:border-accent"
                  />
                </label>
              )}

              <div className="rounded-lg bg-surface-2 p-3 text-xs text-muted">
                <div className="flex items-center gap-2">
                  <Camera size={14} />
                  <span>Meeting ID: {room.room_code}</span>
                </div>
                {media.mediaError && (
                  <p className="mt-2 text-warning">
                    {media.mediaError === "screen-denied"
                      ? "Screen share was cancelled."
                      : "Media permission was denied. You can still join."}
                  </p>
                )}
              </div>

              {error && (
                <p className="rounded-lg bg-danger/15 px-3 py-2 text-sm text-danger">{error}</p>
              )}

              <button
                type="submit"
                disabled={!canJoin || joining}
                className="mt-auto w-full rounded-lg bg-accent py-3 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {joining ? "Joining…" : "Join meeting"}
              </button>
              <p className="text-center text-xs text-muted">
                Media is exchanged peer-to-peer over WebRTC once you join.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
