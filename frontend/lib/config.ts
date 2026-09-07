// Centralized environment configuration (PRD §22: keep ICE configuration centralized).

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function resolveWsBaseUrl(): string {
  const customWs = process.env.NEXT_PUBLIC_WS_BASE_URL;
  if (customWs) {
    if (customWs.startsWith("http://")) return customWs.replace(/^http:\/\//, "ws://");
    if (customWs.startsWith("https://")) return customWs.replace(/^https:\/\//, "wss://");
    return customWs;
  }
  if (API_BASE_URL) {
    if (API_BASE_URL.startsWith("https://")) return API_BASE_URL.replace(/^https:\/\//, "wss://");
    if (API_BASE_URL.startsWith("http://")) return API_BASE_URL.replace(/^http:\/\//, "ws://");
  }
  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    return `wss://${window.location.host}`;
  }
  return "ws://localhost:8000";
}

export const WS_BASE_URL = resolveWsBaseUrl();

export const STUN_SERVER =
  process.env.NEXT_PUBLIC_STUN_SERVER ?? "stun:stun.l.google.com:19302";

function buildIceServers(): RTCIceServer[] {
  // 1. Raw JSON override if provided (e.g. from Coturn, Metered, Twilio, or Xirsys)
  if (process.env.NEXT_PUBLIC_ICE_SERVERS) {
    try {
      const parsed = JSON.parse(process.env.NEXT_PUBLIC_ICE_SERVERS);
      if (Array.isArray(parsed)) return parsed as RTCIceServer[];
    } catch (e) {
      console.warn("Invalid NEXT_PUBLIC_ICE_SERVERS JSON, falling back to default STUN/TURN", e);
    }
  }

  const servers: RTCIceServer[] = [
    {
      urls: [
        STUN_SERVER,
        "stun:stun1.l.google.com:19302",
        "stun:stun2.l.google.com:19302",
      ],
    },
  ];

  // 2. Individual TURN server configuration if provided
  const turnServer = process.env.NEXT_PUBLIC_TURN_SERVER;
  const turnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME;
  const turnCredential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;

  if (turnServer) {
    const turnEntry: RTCIceServer = {
      urls: turnServer.split(",").map((u) => u.trim()),
    };
    if (turnUsername) turnEntry.username = turnUsername;
    if (turnCredential) turnEntry.credential = turnCredential;
    servers.push(turnEntry);
  }

  return servers;
}

export const ICE_SERVERS: RTCIceServer[] = buildIceServers();

export const CHAT_MESSAGE_MAX_LENGTH = 2000;

