"use client";

import { useState, useRef, useEffect } from "react";
import type { ParticipantView } from "@/types";
import VideoTile from "@/components/meeting/VideoTile";

function gridColumns(count: number): number {
  if (count <= 1) return 1;
  if (count <= 4) return 2;
  if (count <= 9) return 3;
  return 4;
}

export interface VideoGridProps {
  participants: ParticipantView[];
  streams: (peerId: string) => MediaStream | null;
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  activeSpeakerId: string | null;
}

/** Gallery view: an adaptive grid of participant tiles (PRD §28). */
export function GalleryView({
  participants,
  streams,
  localStream,
  screenStream,
  activeSpeakerId,
}: VideoGridProps) {
  const columns = gridColumns(participants.length);
  return (
    <div
      className="grid h-full w-full auto-rows-fr gap-2 sm:gap-3"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {participants.map((participant) => (
        <VideoTile
          key={participant.peer_id}
          stream={
            participant.is_self ? (screenStream ?? localStream) : streams(participant.peer_id)
          }
          displayName={participant.display_name}
          isSelf={participant.is_self}
          isMuted={participant.is_muted}
          isVideoOff={participant.is_video_off && !participant.is_screen_sharing}
          isScreenSharing={participant.is_screen_sharing}
          isHost={participant.is_host}
          isSpeaking={activeSpeakerId === participant.peer_id}
        />
      ))}
    </div>
  );
}

/** Speaker view: active speaker (or screen sharer / pinned user) large + film strip (PRD §29). */
export function SpeakerView({
  participants,
  streams,
  localStream,
  screenStream,
  activeSpeakerId,
}: VideoGridProps) {
  const [pinnedPeerId, setPinnedPeerId] = useState<string | null>(null);
  const lastActiveRemoteRef = useRef<string | null>(null);

  // If pinned peer left the room, clear pin
  useEffect(() => {
    if (pinnedPeerId && !participants.some((p) => p.peer_id === pinnedPeerId)) {
      setPinnedPeerId(null);
    }
  }, [participants, pinnedPeerId]);

  // Track the most recent remote speaker so speaker view doesn't abruptly switch between pauses
  const remoteParticipants = participants.filter((p) => !p.is_self);
  const activeRemote = remoteParticipants.find((p) => p.peer_id === activeSpeakerId);

  useEffect(() => {
    if (activeRemote) {
      lastActiveRemoteRef.current = activeRemote.peer_id;
    }
  }, [activeRemote]);

  const sharer = participants.find((p) => p.is_screen_sharing);
  const pinned = pinnedPeerId ? participants.find((p) => p.peer_id === pinnedPeerId) : null;
  const lastActiveRemote = lastActiveRemoteRef.current
    ? remoteParticipants.find((p) => p.peer_id === lastActiveRemoteRef.current)
    : null;

  // Main speaker selection priority:
  // 1. Screen sharer
  // 2. User-pinned participant
  // 3. Current active remote speaker
  // 4. Most recent active remote speaker
  // 5. First remote participant
  // 6. Local participant (if alone in meeting or sharing)
  const main =
    sharer ??
    pinned ??
    activeRemote ??
    lastActiveRemote ??
    remoteParticipants[0] ??
    participants[0];

  const others = participants.filter((participant) => participant.peer_id !== main?.peer_id);

  if (!main) return null;

  const togglePin = (peerId: string) => {
    setPinnedPeerId((prev) => (prev === peerId ? null : peerId));
  };

  return (
    <div className="flex h-full w-full flex-col gap-2 sm:gap-3 overflow-hidden">
      {/* Main Focus Tile */}
      <div className="min-h-0 flex-1 relative rounded-2xl overflow-hidden shadow-2xl">
        <VideoTile
          stream={main.is_self ? (screenStream ?? localStream) : streams(main.peer_id)}
          displayName={main.display_name}
          isSelf={main.is_self}
          isMuted={main.is_muted}
          isVideoOff={main.is_video_off && !main.is_screen_sharing}
          isScreenSharing={main.is_screen_sharing}
          isHost={main.is_host}
          isSpeaking={activeSpeakerId === main.peer_id}
          isPinned={pinnedPeerId === main.peer_id}
          onPin={() => togglePin(main.peer_id)}
        />
      </div>

      {/* Film Strip of other participants */}
      {others.length > 0 && (
        <div className="flex h-20 sm:h-24 shrink-0 gap-2 overflow-x-auto pb-1 pt-0.5 no-scrollbar">
          {others.map((participant) => (
            <div
              key={participant.peer_id}
              className="h-full w-32 sm:w-44 shrink-0 cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]"
              onClick={() => togglePin(participant.peer_id)}
            >
              <VideoTile
                stream={
                  participant.is_self
                    ? (screenStream ?? localStream)
                    : streams(participant.peer_id)
                }
                displayName={participant.display_name}
                isSelf={participant.is_self}
                isMuted={participant.is_muted}
                isVideoOff={participant.is_video_off && !participant.is_screen_sharing}
                isScreenSharing={participant.is_screen_sharing}
                isHost={participant.is_host}
                isSpeaking={activeSpeakerId === participant.peer_id}
                isPinned={pinnedPeerId === participant.peer_id}
                onPin={() => togglePin(participant.peer_id)}
                compact
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
