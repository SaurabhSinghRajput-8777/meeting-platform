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
  ariaLabel?: string;
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
  ariaLabel,
  active = false,
  isMutedOrOff = false,
  isGreenAction = false,
  badge,
  badgeColor = "bg-danger",
  onClick,
  children,
}: ToolbarButtonProps) {
  const accessibleName = ariaLabel ?? label;
  return (
    <button
      type="button"
      onClick={onClick}
      title={accessibleName}
      aria-label={accessibleName}
      className={`group relative flex h-12 sm:h-13 min-w-[46px] sm:min-w-[60px] flex-col items-center justify-center gap-0.5 sm:gap-1 rounded-xl px-1.5 py-1 text-[10px] sm:text-[11px] font-medium transition-all sm:px-3 shrink-0 ${
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
            className={`absolute -right-2 -top-1 sm:-right-2.5 sm:-top-1.5 flex h-3.5 sm:h-4 min-w-3.5 sm:min-w-4 items-center justify-center rounded-full ${badgeColor} px-1 text-[9px] sm:text-[10px] font-bold text-white shadow-sm ring-1 ring-bg`}
          >
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </div>
      <span className="truncate max-w-[50px] sm:max-w-[70px] tracking-tight leading-none text-zinc-400 group-hover:text-zinc-200">
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
    <footer className="relative z-20 flex min-h-[4rem] h-16 w-full shrink-0 select-none items-center justify-between border-t border-line/60 bg-[#14161a]/95 px-2 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-xl sm:px-6">
      {/* Left: Audio & Video Controls */}
      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
        <ToolbarItem
          label={muted ? "Unmute" : "Mute"}
          isMutedOrOff={muted}
          onClick={meeting.toggleMic}
        >
          {muted ? (
            <div className="relative">
              <MicOff size={18} className="text-red-500 sm:w-[19px] sm:h-[19px]" />
            </div>
          ) : (
            <Mic size={18} className="text-zinc-200 sm:w-[19px] sm:h-[19px]" />
          )}
        </ToolbarItem>

        <ToolbarItem
          label={cameraOff ? "Start video" : "Stop video"}
          isMutedOrOff={cameraOff}
          onClick={meeting.toggleCamera}
        >
          {cameraOff ? (
            <VideoOff size={18} className="text-red-500 sm:w-[19px] sm:h-[19px]" />
          ) : (
            <Video size={18} className="text-zinc-200 sm:w-[19px] sm:h-[19px]" />
          )}
        </ToolbarItem>
      </div>

      {/* Center: Meeting Actions (Participants, Chat, Share Screen, View) */}
      <div className="flex min-w-0 max-w-[calc(100vw-170px)] sm:max-w-none items-center gap-0.5 overflow-x-auto no-scrollbar sm:gap-1.5">
        <ToolbarItem
          label="Participants"
          ariaLabel="Participants"
          active={meeting.activePanel === "participants"}
          badge={meeting.participants.length}
          badgeColor="bg-surface-3 text-zinc-200"
          onClick={() =>
            meeting.setActivePanel(meeting.activePanel === "participants" ? null : "participants")
          }
        >
          <Users size={18} className="sm:w-[19px] sm:h-[19px]" />
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
          <MessageSquare size={18} className="sm:w-[19px] sm:h-[19px]" />
        </ToolbarItem>

        {/* Zoom's signature Green Share Screen Button */}
        <ToolbarItem
          label={screenSharing ? "Stop sharing" : "Share screen"}
          ariaLabel={screenSharing ? "Stop sharing" : "Share screen"}
          active={screenSharing}
          isGreenAction={!screenSharing}
          onClick={meeting.toggleScreenShare}
        >
          <MonitorUp size={18} className={`${screenSharing ? "text-danger" : "text-emerald-400"} sm:w-[19px] sm:h-[19px]`} />
        </ToolbarItem>

        <ToolbarItem
          label={meeting.view === "gallery" ? "Speaker" : "Gallery"}
          onClick={() => meeting.setView(meeting.view === "gallery" ? "speaker" : "gallery")}
        >
          {meeting.view === "gallery" ? (
            <Presentation size={18} className="sm:w-[19px] sm:h-[19px]" />
          ) : (
            <LayoutGrid size={18} className="sm:w-[19px] sm:h-[19px]" />
          )}
        </ToolbarItem>
      </div>

      {/* Right: Red End / Leave Meeting Action - ALWAYS VISIBLE, NEVER CLIPPED */}
      <div className="flex shrink-0 items-center pl-1 sm:pl-2">
        {isHost ? (
          <div className="flex items-center gap-1 sm:gap-1.5">
            <button
              type="button"
              onClick={onLeave}
              title="Leave meeting"
              aria-label="Leave"
              className="hidden sm:inline-flex rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs font-semibold text-zinc-300 transition hover:bg-surface-3 hover:text-white"
            >
              Leave
            </button>
            <button
              type="button"
              onClick={onEnd}
              title="End meeting for all"
              aria-label="End meeting"
              className="flex items-center gap-1 rounded-lg bg-red-600 px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700 active:bg-red-800"
            >
              <Square size={12} className="fill-current sm:w-[13px] sm:h-[13px]" />
              <span>End</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onLeave}
            title="Leave meeting"
            aria-label="Leave meeting"
            className="flex items-center gap-1 rounded-lg bg-red-600 px-2.5 sm:px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700 active:bg-red-800"
          >
            <PhoneOff size={13} className="sm:w-[14px] sm:h-[14px]" />
            <span>Leave</span>
          </button>
        )}
      </div>
    </footer>
  );
}

