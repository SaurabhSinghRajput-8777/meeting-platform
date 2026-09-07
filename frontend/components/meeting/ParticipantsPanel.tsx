"use client";

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
  const isHost = meeting.participants.some((p) => p.is_self && p.is_host);

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/meeting/${room.room_code}`);
      window.alert(`Invite link copied: ${window.location.origin}/meeting/${room.room_code}`);
    } catch {
      window.prompt("Copy this invite link:", `${window.location.origin}/meeting/${room.room_code}`);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold">
          Participants ({meeting.participants.length})
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-muted transition hover:bg-surface-3 hover:text-white"
          aria-label="Close participants panel"
        >
          <X size={16} />
        </button>
      </header>

      <div className="border-b border-line px-4 py-3">
        <p className="truncate text-xs text-muted" title={room.title}>
          {room.title}
        </p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="text-xs">
            <span className="text-muted">Meeting ID: </span>
            <span className="font-mono text-white">{room.room_code}</span>
          </div>
          <button
            type="button"
            onClick={() => void copyInvite()}
            className="flex items-center gap-1 rounded bg-surface-3 px-2 py-1 text-xs text-white transition hover:bg-line"
          >
            <Copy size={12} /> Copy link
          </button>
        </div>
      </div>

      <ul className="flex-1 overflow-y-auto p-2">
        {meeting.participants.map((participant) => (
          <li
            key={participant.peer_id}
            className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-2"
          >
            <Avatar name={participant.display_name} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {participant.display_name}
                {participant.is_self && <span className="text-muted"> (You)</span>}
              </p>
              {participant.is_host && (
                <span className="flex items-center gap-1 text-[11px] text-warning">
                  <Crown size={10} /> Host
                </span>
              )}
            </div>
            {meeting.activeSpeakerId === participant.peer_id && (
              <span
                className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-success"
                title="Speaking"
              />
            )}
            <span className="flex items-center gap-2 text-muted">
              {participant.is_muted ? (
                <MicOff size={14} className="text-danger" />
              ) : (
                <UserRound size={14} className="text-success" />
              )}
              {participant.is_video_off ? (
                <VideoOff size={14} />
              ) : (
                <Video size={14} className="text-success" />
              )}
            </span>
            {isHost && !participant.is_self && (
              <span className="flex items-center gap-1">
                {!participant.is_muted && (
                  <button
                    type="button"
                    onClick={() => meeting.hostMute(participant.peer_id)}
                    className="rounded bg-surface-3 px-2 py-1 text-[11px] transition hover:bg-line"
                    title="Mute this participant"
                  >
                    Mute
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => meeting.hostRemove(participant.peer_id)}
                  className="flex items-center gap-1 rounded bg-danger/15 px-2 py-1 text-[11px] text-danger transition hover:bg-danger/25"
                  title="Remove this participant from the meeting"
                >
                  <PhoneOff size={10} /> Remove
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>

      {isHost && (
        <footer className="border-t border-line p-3">
          <button
            type="button"
            onClick={meeting.hostMuteAll}
            className="w-full rounded-lg bg-surface-3 py-2 text-xs font-medium transition hover:bg-line"
          >
            Mute all
          </button>
        </footer>
      )}
    </div>
  );
}
