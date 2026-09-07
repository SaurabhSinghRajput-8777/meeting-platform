"use client";

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
      className="grid h-full w-full auto-rows-fr gap-2"
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

/** Speaker view: active speaker (or screen sharer) large + film strip below (PRD §29). */
export function SpeakerView({
  participants,
  streams,
  localStream,
  screenStream,
  activeSpeakerId,
}: VideoGridProps) {
  const sharer = participants.find((participant) => participant.is_screen_sharing);
  const main =
    sharer ??
    participants.find((participant) => participant.peer_id === activeSpeakerId) ??
    participants[0];
  const others = participants.filter((participant) => participant !== main);

  if (!main) return null;

  return (
    <div className="flex h-full w-full flex-col gap-2">
      <div className="min-h-0 flex-1">
        <VideoTile
          stream={main.is_self ? (screenStream ?? localStream) : streams(main.peer_id)}
          displayName={main.display_name}
          isSelf={main.is_self}
          isMuted={main.is_muted}
          isVideoOff={main.is_video_off && !main.is_screen_sharing}
          isScreenSharing={main.is_screen_sharing}
          isHost={main.is_host}
          isSpeaking={activeSpeakerId === main.peer_id}
        />
      </div>
      {others.length > 0 && (
        <div className="flex h-24 shrink-0 gap-2 overflow-x-auto">
          {others.map((participant) => (
            <div key={participant.peer_id} className="h-full w-40 shrink-0">
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
                compact
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
