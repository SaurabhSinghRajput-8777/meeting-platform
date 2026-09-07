"use client";

import {
  ChevronUp,
  LayoutGrid,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Presentation,
  Square,
  Users,
  Video,
  VideoOff,
} from "lucide-react";
import type { MeetingApi } from "@/hooks/useMeeting";

interface ToolbarButtonProps {
  label: string;
  active?: boolean;
  isMutedOrOff?: boolean;
  isGreenAction?: boolean;
  badge?: number;
  badgeColor?: string;
  onClick: () => void;
  children: React.ReactNode;
}

function ToolbarItem({
  label,
  active = false,
  isMutedOrOff = false,
  isGreenAction = false,
  badge,
  badgeColor = "bg-danger",
  onClick,
  children,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`group relative flex h-13 min-w-[56px] flex-col items-center justify-center gap-1 rounded-xl px-2.5 py-1 text-[11px] font-medium transition-all sm:min-w-[64px] sm:px-3 ${
        active
          ? "bg-accent/20 text-accent ring-1 ring-accent/30"
          : isMutedOrOff
            ? "text-red-400 hover:bg-surface-2 hover:text-red-300"
            : isGreenAction
              ? "text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
              : "text-zinc-300 hover:bg-surface-2 hover:text-white"
      }`}
    >
      <div className="relative flex items-center justify-center">
        {children}
        {badge !== undefined && badge > 0 && (
          <span
            className={`absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full ${badgeColor} px-1 text-[10px] font-bold text-white shadow-sm ring-1 ring-bg`}
          >
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </div>
      <span className="truncate tracking-tight leading-none text-zinc-400 group-hover:text-zinc-200">
        {label}
      </span>
    </button>
  );
}

export default function Toolbar({
  meeting,
  onLeave,
  onEnd,
}: {
  meeting: MeetingApi;
  onLeave: () => void;
  onEnd: () => void;
}) {
  const isHost = meeting.participants.some((p) => p.is_self && p.is_host);
  const muted = meeting.participants.some((p) => p.is_self && p.is_muted);
  const cameraOff = meeting.participants.some((p) => p.is_self && p.is_video_off);
  const screenSharing = meeting.participants.some((p) => p.is_self && p.is_screen_sharing);

  return (
    <footer className="relative z-20 flex h-16 w-full shrink-0 select-none items-center justify-between border-t border-line/60 bg-[#14161a]/95 px-3 backdrop-blur-xl sm:px-6">
      {/* Left: Audio & Video Controls */}
      <div className="flex items-center gap-1">
        <ToolbarItem
          label={muted ? "Unmute" : "Mute"}
          isMutedOrOff={muted}
          onClick={meeting.toggleMic}
        >
          {muted ? (
            <div className="relative">
              <MicOff size={19} className="text-red-500" />
            </div>
          ) : (
            <Mic size={19} className="text-zinc-200" />
          )}
        </ToolbarItem>

        <ToolbarItem
          label={cameraOff ? "Start video" : "Stop video"}
          isMutedOrOff={cameraOff}
          onClick={meeting.toggleCamera}
        >
          {cameraOff ? (
            <VideoOff size={19} className="text-red-500" />
          ) : (
            <Video size={19} className="text-zinc-200" />
          )}
        </ToolbarItem>
      </div>

      {/* Center: Meeting Actions (Participants, Chat, Share Screen, View) */}
      <div className="flex items-center gap-1 sm:gap-2">
        <ToolbarItem
          label="Participants"
          active={meeting.activePanel === "participants"}
          badge={meeting.participants.length}
          badgeColor="bg-surface-3 text-zinc-200"
          onClick={() =>
            meeting.setActivePanel(meeting.activePanel === "participants" ? null : "participants")
          }
        >
          <Users size={19} />
        </ToolbarItem>

        <ToolbarItem
          label="Chat"
          active={meeting.activePanel === "chat"}
          badge={meeting.unreadChat}
          badgeColor="bg-danger"
          onClick={() =>
            meeting.setActivePanel(meeting.activePanel === "chat" ? null : "chat")
          }
        >
          <MessageSquare size={19} />
        </ToolbarItem>

        {/* Zoom's signature Green Share Screen Button */}
        <ToolbarItem
          label={screenSharing ? "Stop sharing" : "Share screen"}
          active={screenSharing}
          isGreenAction={!screenSharing}
          onClick={meeting.toggleScreenShare}
        >
          <MonitorUp size={19} className={screenSharing ? "text-danger" : "text-emerald-400"} />
        </ToolbarItem>

        <ToolbarItem
          label={meeting.view === "gallery" ? "Speaker view" : "Gallery view"}
          onClick={() => meeting.setView(meeting.view === "gallery" ? "speaker" : "gallery")}
        >
          {meeting.view === "gallery" ? <Presentation size={19} /> : <LayoutGrid size={19} />}
        </ToolbarItem>
      </div>

      {/* Right: Red End / Leave Meeting Action */}
      <div className="flex items-center gap-2">
        {isHost ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onLeave}
              title="Leave meeting"
              aria-label="Leave"
              className="rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:bg-surface-3 hover:text-white"
            >
              Leave
            </button>
            <button
              type="button"
              onClick={onEnd}
              title="End meeting for all"
              aria-label="End"
              className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700 active:bg-red-800"
            >
              <Square size={13} className="fill-current" />
              <span>End</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onLeave}
            title="Leave meeting"
            aria-label="Leave"
            className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700 active:bg-red-800"
          >
            <PhoneOff size={14} />
            <span>Leave</span>
          </button>
        )}
      </div>
    </footer>
  );
}

