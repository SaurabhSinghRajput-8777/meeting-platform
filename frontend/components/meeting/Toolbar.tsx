"use client";

import {
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

function ToolbarButton({
  label,
  active = false,
  danger = false,
  badge,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  danger?: boolean;
  badge?: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`relative flex h-11 flex-col items-center justify-center gap-0.5 rounded-lg px-3 text-xs font-medium transition sm:h-12 sm:px-4 ${
        danger
          ? "bg-danger text-white hover:bg-danger-hover"
          : active
            ? "bg-accent text-white hover:bg-accent-hover"
            : "bg-surface-2 text-white hover:bg-surface-3"
      }`}
    >
      {children}
      <span className="hidden sm:block">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
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
    <footer className="flex items-center justify-center gap-1.5 border-t border-line bg-surface px-3 py-2.5 sm:gap-2 sm:px-4">
      <ToolbarButton label={muted ? "Unmute" : "Mute"} danger={muted} onClick={meeting.toggleMic}>
        {muted ? <MicOff size={18} /> : <Mic size={18} />}
      </ToolbarButton>

      <ToolbarButton
        label={cameraOff ? "Start video" : "Stop video"}
        danger={cameraOff}
        onClick={meeting.toggleCamera}
      >
        {cameraOff ? <VideoOff size={18} /> : <Video size={18} />}
      </ToolbarButton>

      <ToolbarButton
        label={screenSharing ? "Stop sharing" : "Share screen"}
        active={screenSharing}
        onClick={meeting.toggleScreenShare}
      >
        <MonitorUp size={18} />
      </ToolbarButton>

      <span className="mx-1 hidden h-8 w-px bg-line sm:block" />

      <ToolbarButton
        label="Participants"
        active={meeting.activePanel === "participants"}
        badge={meeting.participants.length}
        onClick={() =>
          meeting.setActivePanel(meeting.activePanel === "participants" ? null : "participants")
        }
      >
        <Users size={18} />
      </ToolbarButton>

      <ToolbarButton
        label="Chat"
        active={meeting.activePanel === "chat"}
        badge={meeting.unreadChat}
        onClick={() =>
          meeting.setActivePanel(meeting.activePanel === "chat" ? null : "chat")
        }
      >
        <MessageSquare size={18} />
      </ToolbarButton>

      <ToolbarButton
        label={meeting.view === "gallery" ? "Speaker view" : "Gallery view"}
        onClick={() => meeting.setView(meeting.view === "gallery" ? "speaker" : "gallery")}
      >
        {meeting.view === "gallery" ? <Presentation size={18} /> : <LayoutGrid size={18} />}
      </ToolbarButton>

      <span className="mx-1 h-8 w-px bg-line" />

      <ToolbarButton label="Leave" danger onClick={onLeave}>
        <PhoneOff size={18} />
      </ToolbarButton>

      {isHost && (
        <ToolbarButton label="End" danger onClick={onEnd}>
          <Square size={16} />
        </ToolbarButton>
      )}
    </footer>
  );
}
