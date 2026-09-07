"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Calendar,
  CalendarPlus,
  Clock,
  Copy,
  Check,
  History,
  Loader2,
  Plus,
  Share2,
  Tv,
  Video,
  XCircle,
} from "lucide-react";
import Avatar from "@/components/common/Avatar";
import { api, ApiError } from "@/services/api";
import { resolveIdentity, storeIdentity } from "@/lib/identity";
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
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Clock widget state
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    setCurrentTime(new Date());
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
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
      let hostUser = identity;
      if (!hostUser || hostUser.is_default) {
        try {
          hostUser = await api.createGuest(hostUser?.name || "Demo User");
          storeIdentity({ user_id: hostUser.id, name: hostUser.name });
          setIdentity(hostUser);
        } catch {
          // fallback to current identity
        }
      }
      const room = await api.createInstantMeeting("Instant Meeting");
      if (typeof window !== "undefined" && hostUser) {
        window.sessionStorage.setItem(`scaler.host.${room.room_code}`, hostUser.id);
      }
      router.push(`/meeting/${room.room_code}`);
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : "Could not create the meeting.");
      setCreating(false);
    }
  };

  const handleJoin = async (idToUse?: string) => {
    const raw = idToUse ?? joinId;
    const normalized = raw
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

  const copyMeetingLink = (roomCode: string) => {
    const url = `${window.location.origin}/meeting/${roomCode}`;
    navigator.clipboard.writeText(url);
    setCopiedId(roomCode);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#121214] text-white">
      {/* Zoom-style top navigation bar */}
      <header className="border-b border-white/10 bg-[#18181c]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/" className="flex items-center gap-2.5 font-bold tracking-tight text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#0e72ed] text-white shadow-md shadow-blue-500/25">
              <Video size={18} />
            </span>
            <span className="text-base tracking-tight">Scaler Meet</span>
          </Link>

          {identity && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1 pl-1.5 pr-3">
                <Avatar name={identity.name} size="sm" />
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-white/90 leading-none">{identity.name}</span>
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium leading-none mt-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Available
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {notice && (
          <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#1c1c20] px-4 py-3 text-sm text-white/70 shadow-lg">
            <span>{notice}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Dismiss"
              className="text-white/40 hover:text-white"
            >
              <XCircle size={16} />
            </button>
          </div>
        )}

        {loadError && (
          <div className="mb-6 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {loadError}
          </div>
        )}

        {/* Hero Section: Zoom 4 Action Tiles + Live Clock Widget */}
        <section className="grid gap-6 lg:grid-cols-[1.3fr_1fr] items-stretch">
          {/* Zoom 4 Iconic Action Squares */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-6 rounded-2xl border border-white/10 bg-[#18181c] shadow-xl">
            {/* Tile 1: New Meeting (Orange) */}
            <div className="flex flex-col items-center text-center">
              <button
                type="button"
                onClick={() => void handleNewMeeting()}
                disabled={creating}
                className="group relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff7426] to-[#f2531a] text-white shadow-lg shadow-orange-500/30 transition hover:scale-105 active:scale-95 disabled:opacity-50"
                aria-label="New meeting"
              >
                {creating ? <Loader2 size={26} className="animate-spin" /> : <Video size={28} />}
              </button>
              <span className="mt-2.5 text-xs font-semibold text-white/90">New Meeting</span>
              <span className="text-[10px] text-white/40">Instant P2P</span>
            </div>

            {/* Tile 2: Join (Zoom Blue) */}
            <div className="flex flex-col items-center text-center">
              <button
                type="button"
                onClick={() => {
                  setShowJoinModal(true);
                  setTimeout(() => document.getElementById("join-input")?.focus(), 50);
                }}
                className="group flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0e72ed] to-[#005cd9] text-white shadow-lg shadow-blue-500/30 transition hover:scale-105 active:scale-95"
                aria-label="Join a meeting"
              >
                <Plus size={30} />
              </button>
              <span className="mt-2.5 text-xs font-semibold text-white/90">Join</span>
              <span className="text-[10px] text-white/40">With Meeting ID</span>
            </div>

            {/* Tile 3: Schedule (Teal / Slate) */}
            <div className="flex flex-col items-center text-center">
              <Link
                href="/schedule"
                className="group flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2d8cff] to-[#1a7cf7] text-white shadow-lg shadow-blue-400/20 transition hover:scale-105 active:scale-95"
                aria-label="Schedule a meeting"
              >
                <CalendarPlus size={26} />
              </Link>
              <span className="mt-2.5 text-xs font-semibold text-white/90">Schedule</span>
              <span className="text-[10px] text-white/40">Plan for later</span>
            </div>

            {/* Tile 4: Share Screen / Direct Join */}
            <div className="flex flex-col items-center text-center">
              <button
                type="button"
                onClick={() => {
                  setShowJoinModal(true);
                  setTimeout(() => document.getElementById("join-input")?.focus(), 50);
                }}
                className="group flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#3b3b47] to-[#292933] text-white/90 border border-white/10 shadow-md transition hover:scale-105 active:scale-95"
                aria-label="Share Screen / Join"
              >
                <Tv size={26} />
              </button>
              <span className="mt-2.5 text-xs font-semibold text-white/90">Share Screen</span>
              <span className="text-[10px] text-white/40">Join & present</span>
            </div>
          </div>

          {/* Zoom Signature Time & Date Card */}
          <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#1c1c24] to-[#141418] p-6 shadow-xl">
            <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-blue-500/5 blur-3xl" />
            <div>
              <div className="text-3xl font-light tracking-tight text-white/95 sm:text-4xl">
                {currentTime ? (
                  currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                ) : (
                  "--:--"
                )}
              </div>
              <div className="mt-1 text-xs font-medium text-white/50">
                {currentTime ? (
                  currentTime.toLocaleDateString([], {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })
                ) : (
                  "Loading date…"
                )}
              </div>
            </div>

            <div className="mt-6 border-t border-white/5 pt-4">
              <p className="text-[11px] font-medium text-white/40 uppercase tracking-wider">Next up</p>
              {upcoming.length > 0 ? (
                <div className="mt-1.5 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-white/90">{upcoming[0].title}</p>
                    <p className="text-[11px] text-white/50">{formatDateTime(upcoming[0].scheduled_for)}</p>
                  </div>
                  <Link
                    href={`/meeting/${upcoming[0].room_code}`}
                    className="ml-3 shrink-0 rounded-lg bg-[#0e72ed] px-3 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-[#1a7cf7]"
                  >
                    Start
                  </Link>
                </div>
              ) : (
                <p className="mt-1 text-xs text-white/60">No upcoming meetings today</p>
              )}
            </div>
          </div>
        </section>

        {/* Quick Join Bar (Always visible or accessible via ID) */}
        <section className="mt-6 rounded-2xl border border-white/10 bg-[#18181c] p-5 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-white/90">Join with Meeting ID</h2>
              <p className="text-xs text-white/50">Enter the 9-digit code (e.g. 123-456-789)</p>
            </div>
            <div className="flex flex-1 max-w-md items-center gap-2">
              <input
                id="join-input"
                value={joinId}
                onChange={(event) => setJoinId(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void handleJoin();
                }}
                placeholder="123-456-789"
                className={`w-full rounded-xl border bg-[#232328] px-3.5 py-2.5 text-xs text-white placeholder-white/40 outline-none transition ${
                  joinError ? "border-rose-500" : "border-white/15 focus:border-[#0e72ed] focus:ring-1 focus:ring-[#0e72ed]"
                }`}
              />
              <button
                type="button"
                onClick={() => void handleJoin()}
                disabled={joining || !joinId.trim()}
                className="shrink-0 rounded-xl bg-[#0e72ed] px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-blue-500/20 transition hover:bg-[#1a7cf7] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {joining ? "…" : "Join"}
              </button>
            </div>
          </div>
          {joinError && <p className="mt-2 text-xs text-rose-400">{joinError}</p>}
        </section>

        {/* Upcoming & Recent Meetings Section */}
        {loading ? (
          <div className="mt-12 flex items-center justify-center gap-2 text-sm text-white/50">
            <Loader2 size={16} className="animate-spin text-[#0e72ed]" /> Loading your meetings…
          </div>
        ) : (
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            {/* Upcoming */}
            <section className="flex flex-col rounded-2xl border border-white/10 bg-[#18181c] p-5 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/60">
                  <Calendar size={14} className="text-[#0e72ed]" />
                  Upcoming Meetings ({upcoming.length})
                </h3>
                <Link
                  href="/schedule"
                  className="text-xs font-semibold text-[#0e72ed] hover:underline"
                >
                  + Schedule
                </Link>
              </div>

              {upcoming.length === 0 ? (
                <EmptyState
                  icon={<Calendar size={22} className="text-white/30" />}
                  title="No upcoming meetings"
                  text="Schedule a meeting to collaborate with your team."
                />
              ) : (
                <ul className="space-y-2.5 flex-1">
                  {upcoming.map((room) => (
                    <li
                      key={room.id}
                      className="group rounded-xl border border-white/5 bg-[#222227] p-3.5 transition hover:border-white/15 hover:bg-[#27272d]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-white/90">{room.title}</p>
                          <div className="mt-1 flex items-center gap-2 text-[11px] text-white/50">
                            <span>{formatDateTime(room.scheduled_for)}</span>
                            <span>•</span>
                            <span className="font-mono text-white/60">ID: {room.room_code}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => copyMeetingLink(room.room_code)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white"
                            title="Copy invite link"
                          >
                            {copiedId === room.room_code ? (
                              <Check size={13} className="text-emerald-400" />
                            ) : (
                              <Copy size={13} />
                            )}
                          </button>
                          <Link
                            href={`/meeting/${room.room_code}`}
                            className="rounded-lg bg-[#0e72ed] px-3.5 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-[#1a7cf7]"
                          >
                            {room.status === "ACTIVE" ? "Join now" : "Start"}
                          </Link>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Recent History */}
            <section className="flex flex-col rounded-2xl border border-white/10 bg-[#18181c] p-5 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/60">
                  <History size={14} className="text-[#0e72ed]" />
                  Recent Meetings ({recent.length})
                </h3>
              </div>

              {recent.length === 0 ? (
                <EmptyState
                  icon={<History size={22} className="text-white/30" />}
                  title="No recent meetings"
                  text="Meetings you host or participate in will appear here."
                />
              ) : (
                <ul className="space-y-2.5 flex-1">
                  {recent.map((room) => (
                    <li
                      key={room.id}
                      className="rounded-xl border border-white/5 bg-[#222227] p-3.5 transition hover:border-white/15 hover:bg-[#27272d]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-white/90">{room.title}</p>
                          <div className="mt-1 flex items-center gap-2 text-[11px] text-white/50">
                            <span>{formatDateTime(room.created_at)}</span>
                            <span>•</span>
                            <span className="font-mono text-white/60">ID: {room.room_code}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${statusClass(room.status)}`}
                          >
                            {statusLabel(room.status)}
                          </span>
                          {room.status === "ACTIVE" && (
                            <Link
                              href={`/meeting/${room.room_code}`}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-emerald-500"
                            >
                              Rejoin
                            </Link>
                          )}
                        </div>
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

function EmptyState({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-[#141418]/60 p-8 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5">
        {icon}
      </div>
      <p className="mt-2 text-xs font-semibold text-white/80">{title}</p>
      <p className="mt-1 max-w-[220px] text-[11px] text-white/40">{text}</p>
    </div>
  );
}

