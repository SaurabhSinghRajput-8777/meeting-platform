"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { WS_BASE_URL } from "@/lib/config";
import { SignalingClient, type SignalingStatus } from "@/lib/signalingClient";
import { api } from "@/services/api";
import type {
  AppUser,
  ChatMessage,
  ClientMessage,
  ParticipantView,
  PeerSummary,
  RoomDetails,
  ServerMessage,
} from "@/types";
import type { LocalMediaApi } from "@/hooks/useLocalMedia";
import { useWebRTC, type WebRTCMeshApi } from "@/hooks/useWebRTC";
import { useActiveSpeaker } from "@/hooks/useActiveSpeaker";

export type MeetingStatus = "connecting" | "connected" | "disconnected" | "ended";
export type MeetingView = "gallery" | "speaker";
export type MeetingPanel = "participants" | "chat" | null;

export interface Toast {
  id: number;
  text: string;
}

export interface UseMeetingParams {
  room: RoomDetails;
  identity: AppUser;
  displayName: string;
  media: LocalMediaApi;
}

export interface MeetingApi {
  status: MeetingStatus;
  participants: ParticipantView[];
  messages: ChatMessage[];
  view: MeetingView;
  setView: (view: MeetingView) => void;
  activePanel: MeetingPanel;
  setActivePanel: (panel: MeetingPanel) => void;
  activeSpeakerId: string | null;
  unreadChat: number;
  toasts: Toast[];
  rtc: WebRTCMeshApi;
  toggleMic: () => void;
  toggleCamera: () => void;
  toggleScreenShare: () => void;
  sendChat: (text: string) => void;
  hostMute: (peerId: string) => void;
  hostMuteAll: () => void;
  hostRemove: (peerId: string) => void;
  leave: () => Promise<void>;
  end: () => Promise<void>;
}

function peerSummary(message: PeerSummary): ParticipantView {
  return { ...message, is_self: false };
}

/**
 * Composes signaling + WebRTC + local media into one meeting session.
 * React state is deliberately split (application / UI / media / webrtc state,
 * PRD §45); peer connections and streams live in refs inside useWebRTC.
 */
export function useMeeting({ room, identity, displayName, media }: UseMeetingParams): MeetingApi {
  const router = useRouter();

  const [status, setStatus] = useState<MeetingStatus>("connecting");
  const [participants, setParticipants] = useState<ParticipantView[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [view, setView] = useState<MeetingView>("gallery");
  const [activePanel, setActivePanel] = useState<MeetingPanel>(null);
  const [unreadChat, setUnreadChat] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const mediaRef = useRef(media);
  mediaRef.current = media;
  const statusRef = useRef<MeetingStatus>("connecting");
  statusRef.current = status;
  const panelRef = useRef<MeetingPanel>(null);
  panelRef.current = activePanel;
  const selfPeerIdRef = useRef(`peer-${crypto.randomUUID()}`);
  const wsRef = useRef<SignalingClient | null>(null);
  const leftRef = useRef(false);

  const toast = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toastItem) => toastItem.id !== id));
    }, 4000);
  }, []);

  const sendMessage = useCallback(
    (message: ClientMessage) => wsRef.current?.send(message),
    [],
  );

  const rtc = useWebRTC({
    sendMessage,
    getLocalStream: () => mediaRef.current.localStream,
    getSelfPeerId: () => selfPeerIdRef.current,
  });
  const rtcRef = useRef(rtc);
  rtcRef.current = rtc;

  // -----------------------------------------------------------------------
  // Signaling connection + message handling
  // -----------------------------------------------------------------------

  const handleServerMessage = useCallback(
    (message: ServerMessage) => {
      switch (message.type) {
        case "welcome": {
          selfPeerIdRef.current = message.peer_id;
          const self: ParticipantView = {
            peer_id: message.peer_id,
            user_id: identity.id,
            display_name: message.display_name,
            is_host: message.is_host,
            is_muted: !mediaRef.current.micEnabled,
            is_video_off: !mediaRef.current.cameraEnabled,
            is_screen_sharing: mediaRef.current.isScreenSharing,
            is_self: true,
          };
          setParticipants([self, ...message.peers.map(peerSummary)]);
          setStatus("connected");
          statusRef.current = "connected";
          // The newly-joined participant initiates offers to existing peers.
          rtcRef.current.initiateToPeers(message.peers.map((peer) => peer.peer_id));
          break;
        }
        case "peer-joined": {
          const { type: _type, ...summary } = message;
          setParticipants((prev) =>
            prev.some((p) => p.peer_id === summary.peer_id)
              ? prev
              : [...prev, peerSummary(summary)],
          );
          toast(`${summary.display_name} joined the meeting`);
          break;
        }
        case "peer-left": {
          setParticipants((prev) => prev.filter((p) => p.peer_id !== message.peer_id));
          rtcRef.current.removePeer(message.peer_id);
          break;
        }
        case "offer":
        case "answer":
        case "ice-candidate":
          rtcRef.current.handleServerMessage(message);
          break;
        case "media-state": {
          const patch = {
            is_muted: message.is_muted,
            is_video_off: message.is_video_off,
            is_screen_sharing: message.is_screen_sharing,
          };
          setParticipants((prev) =>
            prev.map((p) =>
              p.peer_id === message.peer_id
                ? {
                    ...p,
                    ...Object.fromEntries(
                      Object.entries(patch).filter(([, v]) => v !== null && v !== undefined),
                    ),
                  }
                : p,
            ),
          );
          break;
        }
        case "chat-message": {
          const { type: _type, ...chat } = message;
          setMessages((prev) => [
            ...prev,
            { ...chat, is_self: chat.peer_id === selfPeerIdRef.current },
          ]);
          if (panelRef.current !== "chat" && chat.peer_id !== selfPeerIdRef.current) {
            setUnreadChat((count) => count + 1);
          }
          break;
        }
        case "chat-history":
          setMessages(message.messages.map((chat) => ({ ...chat, is_self: false })));
          break;
        case "host-command": {
          if (message.command === "mute") {
            mediaRef.current.forceMute();
            toast("The host muted your microphone");
          } else if (message.command === "mute-all") {
            mediaRef.current.forceMute();
            toast("The host muted all participants");
          } else if (message.command === "remove") {
            // Clean up locally and return to the dashboard (PRD §33).
            leftRef.current = true;
            try {
              wsRef.current?.close();
            } catch {
              /* already closed */
            }
            rtcRef.current.cleanup();
            mediaRef.current.release();
            router.push("/?notice=removed");
          }
          break;
        }
        case "meeting-ended": {
          leftRef.current = true;
          try {
            wsRef.current?.close();
          } catch {
            /* already closed */
          }
          rtcRef.current.cleanup();
          mediaRef.current.release();
          setStatus("ended");
          statusRef.current = "ended";
          toast("The host ended the meeting");
          window.setTimeout(() => router.push("/"), 2000);
          break;
        }
        case "error":
          if (message.code === "forbidden") {
            toast(message.message);
          } else {
            console.warn("Signaling error:", message.code, message.message);
          }
          break;
        default:
          break;
      }
    },
    [identity.id, router, toast],
  );

  const handleStatusChange = useCallback((wsStatus: SignalingStatus) => {
    if (wsStatus === "closed") {
      if (leftRef.current) return;
      if (statusRef.current === "ended") return;
      setStatus("disconnected");
      statusRef.current = "disconnected";
    }
  }, []);

  useEffect(() => {
    leftRef.current = false;
    // Fresh peer id per connection attempt (also survives React StrictMode's
    // double-mounted effects in dev without triggering duplicate-peer checks).
    selfPeerIdRef.current = `peer-${crypto.randomUUID()}`;
    const client = new SignalingClient(handleServerMessage, handleStatusChange);
    wsRef.current = client;
    const url =
      `${WS_BASE_URL}/ws/rooms/${encodeURIComponent(room.room_code)}` +
      `?peer_id=${encodeURIComponent(selfPeerIdRef.current)}` +
      `&user_id=${encodeURIComponent(identity.id)}` +
      `&display_name=${encodeURIComponent(displayName)}`;
    client.connect(url);

    const handleBeforeUnload = () => client.close();
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      leftRef.current = true;
      client.close();
      rtcRef.current.cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.room_code]);

  // -----------------------------------------------------------------------
  // Local media state -> broadcast media-state + keep self tile in sync
  // -----------------------------------------------------------------------

  const { micEnabled, cameraEnabled, isScreenSharing, localStream, screenStream } = media;

  useEffect(() => {
    if (status !== "connected") return;
    setParticipants((prev) =>
      prev.map((p) =>
        p.is_self
          ? { ...p, is_muted: !micEnabled, is_video_off: !cameraEnabled, is_screen_sharing: isScreenSharing }
          : p,
      ),
    );
    sendMessage({
      type: "media-state",
      is_muted: !micEnabled,
      is_video_off: !cameraEnabled,
      is_screen_sharing: isScreenSharing,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micEnabled, cameraEnabled, isScreenSharing, status]);

  // Screen sharing / late camera/mic: sync local tracks to all peers and swap
  // the outgoing video track (screen share on/off, camera restore).
  useEffect(() => {
    if (status !== "connected") return;
    rtcRef.current.syncLocalTracks(localStream);
    const screenTrack = screenStream?.getVideoTracks()[0] ?? null;
    const cameraTrack = localStream?.getVideoTracks()[0] ?? null;
    rtcRef.current.replaceOutgoingVideoTrack(
      screenTrack ?? cameraTrack,
      screenStream ?? localStream,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenStream, localStream, status]);

  // -----------------------------------------------------------------------
  // Active speaker
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (activePanel === "chat") setUnreadChat(0);
  }, [activePanel]);

  const speakerEntries = useMemo(() => {
    const entries = [];
    if (localStream) entries.push({ id: selfPeerIdRef.current, stream: localStream, isLocal: true });
    for (const peerId of rtc.remotePeerIds) {
      entries.push({ id: peerId, stream: rtc.getRemoteStream(peerId), isLocal: false });
    }
    return entries;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localStream, rtc.remotePeerIds]);

  const activeSpeakerId = useActiveSpeaker(speakerEntries);

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  const toggleMic = useCallback(() => {
    void mediaRef.current.toggleMic();
  }, []);

  const toggleCamera = useCallback(() => {
    void mediaRef.current.toggleCamera();
  }, []);

  const toggleScreenShare = useCallback(() => {
    if (mediaRef.current.isScreenSharing) {
      mediaRef.current.stopScreenShare();
    } else {
      void mediaRef.current.startScreenShare();
    }
  }, []);

  const sendChat = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      sendMessage({ type: "chat-message", message: trimmed.slice(0, 2000) });
    },
    [sendMessage],
  );

  const hostMute = useCallback(
    (peerId: string) => sendMessage({ type: "host-command", command: "mute", target_peer_id: peerId }),
    [sendMessage],
  );

  const hostMuteAll = useCallback(
    () => sendMessage({ type: "host-command", command: "mute-all" }),
    [sendMessage],
  );

  const hostRemove = useCallback(
    (peerId: string) => sendMessage({ type: "host-command", command: "remove", target_peer_id: peerId }),
    [sendMessage],
  );

  const leave = useCallback(async () => {
    leftRef.current = true;
    try {
      wsRef.current?.close();
    } catch {
      /* already closed */
    }
    rtcRef.current.cleanup();
    mediaRef.current.release();
    try {
      await api.leaveRoom(room.room_code);
    } catch {
      // best-effort; the WS disconnect also cleans up server-side
    }
  }, [room.room_code]);

  const end = useCallback(async () => {
    // Server verifies host permission and broadcasts meeting-ended to all.
    // If this throws (e.g. not the host), no local teardown happens.
    await api.endRoom(room.room_code);
    leftRef.current = true;
    try {
      wsRef.current?.close();
    } catch {
      /* already closed */
    }
    rtcRef.current.cleanup();
    mediaRef.current.release();
  }, [room.room_code]);

  return {
    status,
    participants,
    messages,
    view,
    setView,
    activePanel,
    setActivePanel,
    activeSpeakerId,
    unreadChat,
    toasts,
    rtc,
    toggleMic,
    toggleCamera,
    toggleScreenShare,
    sendChat,
    hostMute,
    hostMuteAll,
    hostRemove,
    leave,
    end,
  };
}
