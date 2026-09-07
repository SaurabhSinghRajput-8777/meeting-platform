"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, WifiOff } from "lucide-react";
import type { AppUser, RoomDetails } from "@/types";
import type { LocalMediaApi } from "@/hooks/useLocalMedia";
import { useMeeting } from "@/hooks/useMeeting";
import { GalleryView, SpeakerView } from "@/components/meeting/VideoGrid";
import Toolbar from "@/components/meeting/Toolbar";
import MeetingHeader from "@/components/meeting/MeetingHeader";
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
    <div className="flex h-dvh flex-col overflow-hidden bg-[#121214] text-white">
      {/* Zoom-style top header */}
      <MeetingHeader room={room} meeting={meeting} />

      <div className="relative flex min-h-0 flex-1">
        {/* Video area */}
        <main className="min-w-0 flex-1 p-2 sm:p-3.5 bg-[#121214]">
          {meeting.view === "gallery" ? (
            <GalleryView {...gridProps} />
          ) : (
            <SpeakerView {...gridProps} />
          )}
        </main>

        {/* Side panel: docked on desktop, overlay drawer on mobile */}
        {meeting.activePanel && (
          <aside className="absolute inset-y-0 right-0 z-30 w-full sm:w-[380px] md:static md:w-[360px] shrink-0 border-l border-white/10 bg-[#1c1c20] shadow-2xl md:shadow-none transition-all duration-200">
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
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-[#121214]/90 backdrop-blur-sm">
            <Loader2 size={36} className="animate-spin text-[#0e72ed]" />
            <p className="text-sm font-medium text-white/80">Connecting to meeting…</p>
          </div>
        )}
        {meeting.status === "disconnected" && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-[#121214]/95 p-6 text-center backdrop-blur-md">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400">
              <WifiOff size={30} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Meeting Disconnected</h2>
              <p className="mt-1 text-xs text-white/50">You were disconnected from the conference.</p>
            </div>
            <div className="flex gap-3 mt-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-xl bg-[#0e72ed] px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-[#1a7cf7]"
              >
                Rejoin
              </button>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
              >
                Back to dashboard
              </button>
            </div>
          </div>
        )}
        {meeting.status === "ended" && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-[#121214]/95 p-6 text-center backdrop-blur-md">
            <p className="text-base font-semibold text-white/95">The host ended this meeting</p>
            <p className="text-xs text-white/50">Returning to dashboard…</p>
          </div>
        )}

        {/* Toasts */}
        <div className="pointer-events-none absolute left-1/2 top-4 z-50 flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-4">
          {meeting.toasts.map((toast) => (
            <div
              key={toast.id}
              className="rounded-xl border border-white/10 bg-[#25252a]/95 px-4 py-2 text-xs font-medium text-white shadow-xl backdrop-blur-md"
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
