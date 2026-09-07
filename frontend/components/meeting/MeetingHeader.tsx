"use client";

import { useState, useRef, useEffect } from "react";
import {
  Check,
  Copy,
  Info,
  LayoutGrid,
  Maximize2,
  Minimize2,
  PhoneOff,
  Presentation,
  ShieldCheck,
  Square,
  X,
} from "lucide-react";
import type { RoomDetails } from "@/types";
import type { MeetingApi } from "@/hooks/useMeeting";

export interface MeetingHeaderProps {
  room: RoomDetails;
  meeting: MeetingApi;
  onLeave?: () => void;
  onEnd?: () => void;
}

export default function MeetingHeader({ room, meeting, onLeave, onEnd }: MeetingHeaderProps) {
  const [showInfo, setShowInfo] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const isHost = meeting.participants.some((p) => p.is_self && p.is_host);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setShowInfo(false);
      }
    };
    if (showInfo) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showInfo]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const copyInviteLink = async () => {
    const url = `${window.location.origin}/meeting/${room.room_code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      window.prompt("Copy invite link:", url);
    }
  };

  const copyMeetingId = async () => {
    try {
      await navigator.clipboard.writeText(room.room_code);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      window.prompt("Copy meeting ID:", room.room_code);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => undefined);
    } else {
      document.exitFullscreen().catch(() => undefined);
    }
  };

  return (
    <header className="relative z-30 flex h-11 shrink-0 select-none items-center justify-between border-b border-line/40 bg-surface/90 px-3 backdrop-blur-md transition sm:px-4">
      {/* Left: Meeting Info Shield */}
      <div className="relative flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowInfo((prev) => !prev)}
          className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition ${
            showInfo
              ? "bg-emerald-500/20 text-emerald-400"
              : "text-muted hover:bg-surface-2 hover:text-white"
          }`}
          title="Meeting information"
          aria-label="Meeting information"
        >
          <ShieldCheck size={16} className="text-emerald-400" />
          <span className="hidden font-mono tracking-wide sm:inline">{room.room_code}</span>
        </button>

        {/* Info Popover */}
        {showInfo && (
          <div
            ref={popoverRef}
            className="absolute left-0 top-10 w-80 rounded-xl border border-line bg-surface-2/95 p-4 text-xs shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-start justify-between border-b border-line/60 pb-3">
              <div>
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <ShieldCheck size={15} />
                  <span>Secure P2P Mesh Meeting</span>
                </div>
                <h3 className="mt-1 text-sm font-bold text-white truncate max-w-[220px]">
                  {room.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInfo(false)}
                className="rounded p-1 text-muted hover:bg-surface-3 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>

            <div className="mt-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-muted">Meeting ID</span>
                <button
                  type="button"
                  onClick={copyMeetingId}
                  className="flex items-center gap-1.5 font-mono text-white hover:text-accent font-medium transition"
                  title="Click to copy"
                >
                  <span>{room.room_code}</span>
                  {copiedId ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted">Host</span>
                <span className="font-medium text-white">{room.host.name}</span>
              </div>

              {room.has_passcode && (
                <div className="flex items-center justify-between">
                  <span className="text-muted">Passcode</span>
                  <span className="font-mono text-warning">Protected</span>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={copyInviteLink}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent py-2 text-xs font-semibold text-white transition hover:bg-accent-hover shadow-sm"
                >
                  {copiedLink ? (
                    <>
                      <Check size={14} className="text-white" /> Link copied!
                    </>
                  ) : (
                    <>
                      <Copy size={14} /> Copy invite link
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Center: Meeting Title & Status */}
      <div className="flex items-center gap-2 text-xs">
        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="font-medium text-white/90 truncate max-w-[180px] sm:max-w-md">
          {room.title}
        </span>
      </div>

      {/* Right: View & Fullscreen Controls */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => meeting.setView(meeting.view === "gallery" ? "speaker" : "gallery")}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 text-xs font-medium text-white/90 transition hover:bg-surface-3 hover:text-white"
          title={`Switch to ${meeting.view === "gallery" ? "Speaker" : "Gallery"} view`}
        >
          {meeting.view === "gallery" ? (
            <>
              <Presentation size={14} className="text-muted" />
              <span className="hidden sm:inline">Speaker</span>
            </>
          ) : (
            <>
              <LayoutGrid size={14} className="text-muted" />
              <span className="hidden sm:inline">Gallery</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={toggleFullscreen}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-white"
          title={isFullscreen ? "Exit full screen" : "Enter full screen"}
          aria-label="Toggle full screen"
        >
          {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>

        {/* Compact Mobile-Only End / Leave Shortcut */}
        {isHost ? (
          <button
            type="button"
            onClick={onEnd}
            className="flex sm:hidden h-8 items-center gap-1 rounded-lg bg-red-600 px-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700 active:bg-red-800"
            title="End meeting for all"
            aria-label="End meeting"
          >
            <Square size={11} className="fill-current" />
            <span>End</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onLeave}
            className="flex sm:hidden h-8 items-center gap-1 rounded-lg bg-red-600 px-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700 active:bg-red-800"
            title="Leave meeting"
            aria-label="Leave meeting"
          >
            <PhoneOff size={12} />
            <span>Leave</span>
          </button>
        )}
      </div>
    </header>
  );
}
