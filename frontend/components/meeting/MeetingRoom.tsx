"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, WifiOff } from "lucide-react";
import type { AppUser, RoomDetails } from "@/types";
import type { LocalMediaApi } from "@/hooks/useLocalMedia";
import { useMeeting } from "@/hooks/useMeeting";
import { GalleryView, SpeakerView } from "@/components/meeting/VideoGrid";
import Toolbar from "@/components/meeting/Toolbar";
import ParticipantsPanel from "@/components/meeting/ParticipantsPanel";
import ChatPanel from "@/components/meeting/ChatPanel";

export interface MeetingRoomProps {
  room: RoomDetails;
  identity: AppUser;
  displayName: string;
  media: LocalMediaApi;
}

export default function MeetingRoom({ room, identity, displayName, media }: MeetingRoomProps) {
  const router = useRouter();
  const meeting = useMeeting({ room, identity, displayName, media });

  const handleLeave = async () => {
    await meeting.leave();
    router.push("/");
  };

  const handleEnd = async () => {
    try {
      await meeting.end();
    } finally {
      router.push("/");
    }
  };

  const gridProps = {
    participants: meeting.participants,
    streams: meeting.rtc.getRemoteStream,
    localStream: media.localStream,
    screenStream: media.screenStream,
    activeSpeakerId: meeting.activeSpeakerId,
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg">
      <div className="relative flex min-h-0 flex-1">
        {/* Video area */}
        <main className="min-w-0 flex-1 p-2 sm:p-3">
          {meeting.view === "gallery" ? (
            <GalleryView {...gridProps} />
          ) : (
            <SpeakerView {...gridProps} />
          )}
        </main>

        {/* Side panel: docked on desktop, overlay drawer on mobile */}
        {meeting.activePanel && (
          <aside className="absolute inset-y-0 right-0 z-20 w-full max-w-full border-l border-line bg-surface shadow-2xl md:static md:w-80 md:shrink-0 md:shadow-none">
            {meeting.activePanel === "participants" ? (
              <ParticipantsPanel
                meeting={meeting}
                room={room}
                onClose={() => meeting.setActivePanel(null)}
              />
            ) : (
              <ChatPanel meeting={meeting} onClose={() => meeting.setActivePanel(null)} />
            )}
          </aside>
        )}

        {/* Status overlays */}
        {meeting.status === "connecting" && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-bg/90">
            <Loader2 size={32} className="animate-spin text-accent" />
            <p className="text-sm text-muted">Connecting to the meeting…</p>
          </div>
        )}
        {meeting.status === "disconnected" && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-bg/90">
            <WifiOff size={32} className="text-danger" />
            <p className="text-sm text-white">You were disconnected from the meeting.</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover"
              >
                Rejoin
              </button>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="rounded-lg bg-surface-3 px-4 py-2 text-sm font-medium text-white transition hover:bg-line"
              >
                Back to dashboard
              </button>
            </div>
          </div>
        )}
        {meeting.status === "ended" && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-bg/95">
            <p className="text-base font-semibold">The host ended this meeting</p>
            <p className="text-sm text-muted">Returning to the dashboard…</p>
          </div>
        )}

        {/* Toasts */}
        <div className="pointer-events-none absolute left-1/2 top-3 z-40 flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2">
          {meeting.toasts.map((toast) => (
            <div
              key={toast.id}
              className="rounded-lg bg-surface-3/95 px-4 py-2 text-sm text-white shadow-lg"
            >
              {toast.text}
            </div>
          ))}
        </div>
      </div>

      <Toolbar meeting={meeting} onLeave={() => void handleLeave()} onEnd={() => void handleEnd()} />
    </div>
  );
}
