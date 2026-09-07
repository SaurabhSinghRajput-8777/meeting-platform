// Centralized environment configuration (PRD §22: keep ICE configuration centralized).

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export const WS_BASE_URL =
  process.env.NEXT_PUBLIC_WS_BASE_URL ?? "ws://localhost:8000";

export const STUN_SERVER =
  process.env.NEXT_PUBLIC_STUN_SERVER ?? "stun:stun.l.google.com:19302";

export const ICE_SERVERS: RTCIceServer[] = [
  { urls: [STUN_SERVER] },
];

export const CHAT_MESSAGE_MAX_LENGTH = 2000;
