"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Video } from "lucide-react";
import { api, ApiError } from "@/services/api";
import { resolveIdentity } from "@/lib/identity";
import { useLocalMedia } from "@/hooks/useLocalMedia";
import Lobby from "@/components/lobby/Lobby";
import MeetingRoom from "@/components/meeting/MeetingRoom";
import type { AppUser, RoomDetails } from "@/types";

type Phase = "loading" | "lobby" | "meeting" | "not-found" | "ended" | "error";

export default function MeetingPage() {
  const params = useParams<{ roomCode: string }>();
  const roomCode = params?.roomCode ?? "";
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("loading");
  const [room, setRoom] = useState<RoomDetails | null>(null);
  const [identity, setIdentity] = useState<AppUser | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // The same local media instance is shared by the lobby preview and the
  // meeting so the acquired stream/permissions carry over on join.
  const media = useLocalMedia();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [me, roomData] = await Promise.all([
          resolveIdentity(api),
          api.validateRoom(roomCode),
        ]);
        if (cancelled) return;
        setIdentity(me);
        setRoom(roomData);
        setDisplayName(me.name);
        setPhase("lobby");
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 404) {
          setPhase("not-found");
        } else if (error instanceof ApiError && error.status === 409) {
          setPhase("ended");
        } else {
          setLoadError(error instanceof Error ? error.message : "Failed to load the meeting");
          setPhase("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roomCode]);

  const handleJoin = async (options: { displayName: string; passcode?: string }) => {
    if (!room || !identity) return;
    setJoining(true);
    setJoinError(null);
    try {
      const trimmed = options.displayName.trim();
      // Mock-user mode: every browser starts as the same default user. To keep
      // host authorization meaningful, a browser joining a room it does not
      // host gets a distinct guest identity (created once, then persisted in
      // localStorage). The room's host always keeps their creating identity.
      const isRoomHost = identity.id === room.host.id;
      const needsGuestIdentity = !isRoomHost && (identity.is_default || trimmed !== identity.name);
      let joinIdentity = identity;
      if (needsGuestIdentity) {
        joinIdentity = await api.createGuest(trimmed || identity.name);
        setIdentity(joinIdentity);
      }
      const finalName = trimmed || joinIdentity.name;
      setDisplayName(finalName);
      const joinedRoom = await api.joinRoom(room.room_code, {
        display_name: finalName,
        passcode: options.passcode,
      });
      setRoom(joinedRoom);
      setPhase("meeting");
    } catch (error) {
      setJoinError(error instanceof ApiError ? error.message : "Failed to join the meeting");
    } finally {
      setJoining(false);
    }
  };

  if (phase === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-muted">
        Loading meeting…
      </div>
    );
  }

  if (phase === "not-found" || phase === "ended" || phase === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg p-4 text-center">
        <Video size={36} className="text-muted" />
        <h1 className="text-lg font-semibold">
          {phase === "not-found"
            ? "Meeting not found"
            : phase === "ended"
              ? "This meeting has already ended"
              : "Something went wrong"}
        </h1>
        <p className="max-w-sm text-sm text-muted">
          {phase === "error"
            ? loadError
            : `We couldn't open meeting ${roomCode}. Please check the meeting ID or ask the host for a new link.`}
        </p>
        <Link
          href="/"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (phase === "lobby" && room && identity) {
    return (
      <Lobby
        room={room}
        media={media}
        defaultName={displayName || identity.name}
        onJoin={(options) => void handleJoin(options)}
        joining={joining}
        error={joinError}
      />
    );
  }

  if (phase === "meeting" && room && identity) {
    return (
      <MeetingRoom
        room={room}
        identity={identity}
        displayName={displayName || identity.name}
        media={media}
      />
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg text-muted">
      <button type="button" onClick={() => router.push("/")}>
        <ArrowLeft size={16} className="inline" /> Return to dashboard
      </button>
    </div>
  );
}
