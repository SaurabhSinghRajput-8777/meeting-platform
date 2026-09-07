// Centralized environment configuration (PRD §22: keep ICE configuration centralized).

export const DEFAULT_PRODUCTION_API_BASE_URL =
  "https://meeting-platform-production-9505.up.railway.app";
export const DEFAULT_PRODUCTION_WS_BASE_URL =
  "wss://meeting-platform-production-9505.up.railway.app";

export function getApiBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const isLocalhost = host === "localhost" || host === "127.0.0.1" || host === "::1";
    if (!isLocalhost) {
      if (!envUrl || envUrl.includes("localhost") || envUrl.includes("127.0.0.1")) {
        return DEFAULT_PRODUCTION_API_BASE_URL;
      }
      return envUrl.replace(/\/+$/, "");
    }
  }
  if (envUrl && envUrl.trim() !== "") {
    return envUrl.replace(/\/+$/, "");
  }
  return "http://localhost:8000";
}

export function getWsBaseUrl(): string {
  const customWs = process.env.NEXT_PUBLIC_WS_BASE_URL;
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const isLocalhost = host === "localhost" || host === "127.0.0.1" || host === "::1";
    if (!isLocalhost) {
      if (!customWs || customWs.includes("localhost") || customWs.includes("127.0.0.1")) {
        return DEFAULT_PRODUCTION_WS_BASE_URL;
      }
      if (customWs.startsWith("http://")) return customWs.replace(/^http:\/\//, "ws://").replace(/\/+$/, "");
      if (customWs.startsWith("https://")) return customWs.replace(/^https:\/\//, "wss://").replace(/\/+$/, "");
      return customWs.replace(/\/+$/, "");
    }
  }
  if (customWs && customWs.trim() !== "") {
    if (customWs.startsWith("http://")) return customWs.replace(/^http:\/\//, "ws://").replace(/\/+$/, "");
    if (customWs.startsWith("https://")) return customWs.replace(/^https:\/\//, "wss://").replace(/\/+$/, "");
    return customWs.replace(/\/+$/, "");
  }
  const apiBase = getApiBaseUrl();
  if (apiBase.startsWith("https://")) return apiBase.replace(/^https:\/\//, "wss://");
  if (apiBase.startsWith("http://")) return apiBase.replace(/^http:\/\//, "ws://");
  return "ws://localhost:8000";
}

export const API_BASE_URL = getApiBaseUrl();
export const WS_BASE_URL = getWsBaseUrl();

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

