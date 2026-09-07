// Shared application types (frontend side of the API + signaling contracts).

export interface AppUser {
  id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  is_default?: boolean;
  clerk_enabled?: boolean;
}

export type RoomStatus = "SCHEDULED" | "ACTIVE" | "ENDED";

export interface RoomDetails {
  id: number;
  room_code: string;
  title: string;
  description: string | null;
  scheduled_for: string | null;
  duration_minutes: number | null;
  media_room_id: string | null;
  status: RoomStatus;
  has_passcode: boolean;
  is_host: boolean;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  host: AppUser;
}

export interface ChatMessage {
  id: number;
  peer_id: string;
  sender_name: string;
  message: string;
  created_at: string;
  is_self?: boolean;
}

export interface PeerSummary {
  peer_id: string;
  user_id: string;
  display_name: string;
  is_host: boolean;
  is_muted: boolean;
  is_video_off: boolean;
  is_screen_sharing: boolean;
}

export interface ParticipantView extends PeerSummary {
  is_self: boolean;
}

// ---------------------------------------------------------------------------
// Signaling protocol (client -> server)
// ---------------------------------------------------------------------------

export type ClientMessage =
  | {
      type: "offer";
      target_peer_id: string;
      sdp: { type: "offer"; sdp: string };
    }
  | {
      type: "answer";
      target_peer_id: string;
      sdp: { type: "answer"; sdp: string };
    }
  | { type: "ice-candidate"; target_peer_id: string; candidate: RTCIceCandidateInit }
  | {
      type: "media-state";
      is_muted?: boolean;
      is_video_off?: boolean;
      is_screen_sharing?: boolean;
    }
  | { type: "chat-message"; message: string }
  | { type: "host-command"; command: "mute" | "mute-all" | "remove"; target_peer_id?: string };

// ---------------------------------------------------------------------------
// Signaling protocol (server -> client)
// ---------------------------------------------------------------------------

export type ServerMessage =
  | {
      type: "welcome";
      peer_id: string;
      display_name: string;
      is_host: boolean;
      room_status: RoomStatus;
      peers: PeerSummary[];
    }
  | { type: "chat-history"; messages: Omit<ChatMessage, "is_self">[] }
  | ({ type: "peer-joined" } & PeerSummary)
  | { type: "peer-left"; peer_id: string }
  | { type: "offer"; from_peer_id: string; sdp: { type: "offer"; sdp: string } }
  | { type: "answer"; from_peer_id: string; sdp: { type: "answer"; sdp: string } }
  | { type: "ice-candidate"; from_peer_id: string; candidate: RTCIceCandidateInit }
  | {
      type: "media-state";
      peer_id: string;
      is_muted?: boolean;
      is_video_off?: boolean;
      is_screen_sharing?: boolean;
    }
  | ({ type: "chat-message" } & Omit<ChatMessage, "is_self">)
  | { type: "host-command"; command: "mute" | "mute-all" | "remove"; from_host: boolean }
  | { type: "meeting-ended" }
  | { type: "error"; code: string; message: string };
