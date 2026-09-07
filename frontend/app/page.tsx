"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarPlus,
  Loader2,
  Plus,
  Video,
  XCircle,
} from "lucide-react";
import Avatar from "@/components/common/Avatar";
import { api, ApiError } from "@/services/api";
import { resolveIdentity } from "@/lib/identity";
import { formatDateTime, statusClass, statusLabel } from "@/lib/utils";
import type { AppUser, RoomDetails } from "@/types";

const JOIN_ID_PATTERN = /^\d{3}-\d{3}-\d{3}$/;

export default function DashboardPage() {
  const router = useRouter();

  const [identity, setIdentity] = useState<AppUser | null>(null);
  const [upcoming, setUpcoming] = useState<RoomDetails[]>([]);
  const [recent, setRecent] = useState<RoomDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [joinId, setJoinId] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    // Shown after being removed from a meeting by the host (?notice=removed).
    if (typeof window !== "undefined" && window.location.search.includes("notice=removed")) {
      setNotice("You were removed from the meeting by the host.");
      window.history.replaceState(null, "", "/");
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const me = await resolveIdentity(api);
      const [upcomingData, recentData] = await Promise.all([api.getUpcoming(), api.getRecent()]);
      setIdentity(me);
      setUpcoming(upcomingData.rooms);
      setRecent(recentData.rooms);
      setLoadError(null);
    } catch (error) {
      setLoadError(
        error instanceof ApiError ? error.message : "Could not load your meetings.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleNewMeeting = async () => {
    setCreating(true);
    try {
      const room = await api.createInstantMeeting("Instant Meeting");
      router.push(`/meeting/${room.room_code}`);
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : "Could not create the meeting.");
      setCreating(false);
    }
  };

  const handleJoin = async () => {
    // Normalize input: strip whitespace and accept both 123456789 and 123-456-789.
    const normalized = joinId
      .trim()
      .replace(/\s+/g, "")
      .replace(/^(\d{3})(\d{3})(\d{3})$/, "$1-$2-$3");
    if (!JOIN_ID_PATTERN.test(normalized)) {
      setJoinError("Enter a valid meeting ID (format: 123-456-789)");
      return;
    }
    setJoining(true);
    setJoinError(null);
    try {
      await api.validateRoom(normalized);
      router.push(`/meeting/${normalized}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setJoinError("No meeting found with that ID");
      } else if (error instanceof ApiError && error.status === 409) {
        setJoinError("That meeting has already ended");
      } else {
        setJoinError(error instanceof Error ? error.message : "Could not join the meeting");
      }
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
              <Video size={16} />
            </span>
            Scaler Meet
          </Link>
          {identity && (
            <div className="flex items-center gap-2 text-sm">
              <Avatar name={identity.name} size="sm" />
              <span className="hidden sm:block">{identity.name}</span>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {notice && (
          <div className="mb-6 flex items-center justify-between gap-3 rounded-lg bg-surface px-4 py-3 text-sm text-muted">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
              <XCircle size={16} />
            </button>
          </div>
        )}

        {loadError && (
          <div className="mb-6 rounded-lg bg-danger/15 px-4 py-3 text-sm text-danger">{loadError}</div>
        )}

        {/* Primary actions */}
        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-surface p-5">
            <button
              type="button"
              onClick={() => void handleNewMeeting()}
              disabled={creating}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-success text-white transition hover:opacity-90 disabled:opacity-50"
              aria-label="New meeting"
            >
              {creating ? <Loader2 size={20} className="animate-spin" /> : <Plus size={22} />}
            </button>
            <h2 className="mt-4 font-semibold">New Meeting</h2>
            <p className="mt-1 text-sm text-muted">Start an instant meeting right away</p>
          </div>

          <div className="rounded-2xl bg-surface p-5">
            <button
              type="button"
              onClick={() => document.getElementById("join-input")?.focus()}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white transition hover:opacity-90"
              aria-label="Join a meeting"
            >
              <Video size={20} />
            </button>
            <h2 className="mt-4 font-semibold">Join</h2>
            <div className="mt-3 flex gap-2">
              <input
                id="join-input"
                value={joinId}
                onChange={(event) => setJoinId(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void handleJoin();
                }}
                placeholder="123-456-789"
                className={`min-w-0 flex-1 rounded-lg border bg-surface-2 px-3 py-2 text-sm outline-none transition ${
                  joinError ? "border-danger" : "border-line focus:border-accent"
                }`}
              />
              <button
                type="button"
                onClick={() => void handleJoin()}
                disabled={joining}
                className="shrink-0 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
              >
                {joining ? "…" : "Join"}
              </button>
            </div>
            {joinError && <p className="mt-2 text-xs text-danger">{joinError}</p>}
          </div>

          <div className="rounded-2xl bg-surface p-5">
            <Link
              href="/schedule"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-3 text-white transition hover:bg-line"
              aria-label="Schedule a meeting"
            >
              <CalendarPlus size={20} />
            </Link>
            <h2 className="mt-4 font-semibold">Schedule</h2>
            <p className="mt-1 text-sm text-muted">Plan a meeting for later</p>
          </div>
        </section>

        {/* Lists */}
        {loading ? (
          <div className="mt-10 flex items-center justify-center gap-2 text-sm text-muted">
            <Loader2 size={16} className="animate-spin" /> Loading your meetings…
          </div>
        ) : (
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
                Upcoming meetings
              </h3>
              {upcoming.length === 0 ? (
                <EmptyState text="No upcoming meetings. Schedule one to see it here." />
              ) : (
                <ul className="space-y-2">
                  {upcoming.map((room) => (
                    <li key={room.id} className="rounded-xl bg-surface p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{room.title}</p>
                          <p className="mt-0.5 text-xs text-muted">
                            {formatDateTime(room.scheduled_for)} · ID {room.room_code}
                          </p>
                        </div>
                        <Link
                          href={`/meeting/${room.room_code}`}
                          className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white transition hover:bg-accent-hover"
                        >
                          {room.status === "ACTIVE" ? "Join now" : "Start"}
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
                Recent meetings
              </h3>
              {recent.length === 0 ? (
                <EmptyState text="No recent meetings yet. Meetings you host or join will appear here." />
              ) : (
                <ul className="space-y-2">
                  {recent.map((room) => (
                    <li
                      key={room.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface p-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{room.title}</p>
                        <p className="mt-0.5 text-xs text-muted">
                          {formatDateTime(room.created_at)} · ID {room.room_code}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${statusClass(room.status)}`}
                        >
                          {statusLabel(room.status)}
                        </span>
                        {room.status === "ACTIVE" && (
                          <Link
                            href={`/meeting/${room.room_code}`}
                            className="rounded-lg bg-surface-3 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-line"
                          >
                            Rejoin
                          </Link>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-surface/50 px-4 py-10 text-center">
      <Video size={24} className="text-muted" />
      <p className="max-w-xs text-sm text-muted">{text}</p>
    </div>
  );
}
