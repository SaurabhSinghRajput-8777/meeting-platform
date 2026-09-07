"use client";

import { useState } from "react";
import { Copy, Crown, MicOff, PhoneOff, UserRound, Video, VideoOff, X } from "lucide-react";
import Avatar from "@/components/common/Avatar";
import type { RoomDetails } from "@/types";
import type { MeetingApi } from "@/hooks/useMeeting";

export default function ParticipantsPanel({
  meeting,
  room,
  onClose,
}: {
  meeting: MeetingApi;
  room: RoomDetails;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const isHost = meeting.participants.some((p) => p.is_self && p.is_host);

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/meeting/${room.room_code}`);
      window.alert(`Invite link copied: ${window.location.origin}/meeting/${room.room_code}`);
    } catch {
      window.prompt("Copy this invite link:", `${window.location.origin}/meeting/${room.room_code}`);
    }
  };

  const filtered = meeting.participants.filter((p) =>
    p.display_name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex h-full flex-col bg-[#18181c] text-white">
      {/* Panel Header */}
      <header className="flex h-12 items-center justify-between border-b border-line/60 px-4">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-200">
          Participants ({meeting.participants.length})
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-surface-3 hover:text-white"
          aria-label="Close participants panel"
        >
          <X size={15} />
        </button>
      </header>

      {/* Search & Meeting Info */}
      <div className="border-b border-line/50 p-3 space-y-2">
        <div className="flex items-center gap-2 rounded-lg bg-surface px-2.5 py-1.5 text-xs text-muted border border-line/40">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search participants…"
            className="w-full bg-transparent text-xs text-white placeholder-zinc-500 outline-none"
          />
        </div>
      </div>

      {/* Participant List */}
      <ul className="flex-1 overflow-y-auto px-2 py-1.5 space-y-0.5">
        {filtered.map((participant) => (
          <li
            key={participant.peer_id}
            className="group flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition hover:bg-surface-2/80"
          >
            <Avatar name={participant.display_name} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-xs font-semibold text-zinc-200">
                  {participant.display_name}
                </span>
                {participant.is_self && (
                  <span className="shrink-0 text-[11px] text-zinc-500 font-normal">
                    (Me)
                  </span>
                )}
              </div>
              {participant.is_host && (
                <span className="flex items-center gap-1 text-[10px] font-medium text-amber-400">
                  <Crown size={10} className="fill-amber-400/20" /> Host
                </span>
              )}
            </div>

            {meeting.activeSpeakerId === participant.peer_id && (
              <span
                className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-500"
                title="Speaking"
              />
            )}

            {/* Media status indicators */}
            <div className="flex items-center gap-1.5 text-zinc-400">
              {participant.is_muted ? (
                <MicOff size={15} className="text-red-500" />
              ) : (
                <UserRound size={15} className="text-emerald-400" />
              )}
              {participant.is_video_off ? (
                <VideoOff size={15} className="text-zinc-500" />
              ) : (
                <Video size={15} className="text-zinc-200" />
              )}
            </div>

            {/* Host action controls */}
            {isHost && !participant.is_self && (
              <div className="flex items-center gap-1 pl-1">
                {!participant.is_muted && (
                  <button
                    type="button"
                    onClick={() => meeting.hostMute(participant.peer_id)}
                    className="rounded-md bg-surface-3 px-2 py-1 text-[11px] font-medium text-zinc-200 transition hover:bg-line hover:text-white"
                    title="Mute this participant"
                  >
                    Mute
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => meeting.hostRemove(participant.peer_id)}
                  className="flex items-center gap-1 rounded-md bg-red-500/15 px-2 py-1 text-[11px] font-medium text-red-400 transition hover:bg-red-500/25"
                  title="Remove this participant from the meeting"
                >
                  <PhoneOff size={10} /> Remove
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* Footer Actions */}
      <footer className="border-t border-line/60 p-3 bg-surface-2/40 flex gap-2">
        <button
          type="button"
          onClick={() => void copyInvite()}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-surface-3 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-line hover:text-white"
        >
          <Copy size={13} /> Copy link
        </button>
        {isHost && (
          <button
            type="button"
            onClick={meeting.hostMuteAll}
            className="flex-1 rounded-lg bg-surface-3 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-line hover:text-white"
          >
            Mute all
          </button>
        )}
      </footer>
    </div>
  );
}
