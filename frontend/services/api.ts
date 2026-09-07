import type { AppUser, RoomDetails } from "@/types";
import { API_BASE_URL } from "@/lib/config";
import { getStoredIdentity } from "@/lib/identity";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const stored = getStoredIdentity();
  if (stored) headers["X-User-Id"] = stored.user_id;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Is the backend running?");
  }

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const data = await response.json();
      if (typeof data.detail === "string") detail = data.detail;
    } catch {
      // keep statusText
    }
    throw new ApiError(response.status, detail);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export interface SchedulePayload {
  title: string;
  description?: string;
  scheduled_for: string; // UTC ISO string
  duration_minutes: number;
  passcode?: string;
}

export const api = {
  getMe: () => request<AppUser>("/api/v1/auth/me"),

  createGuest: (name: string) =>
    request<AppUser>("/api/v1/auth/guest", { method: "POST", body: { name } }),

  createInstantMeeting: (title: string) =>
    request<RoomDetails>("/api/v1/rooms/instant", { method: "POST", body: { title } }),

  scheduleMeeting: (payload: SchedulePayload) =>
    request<RoomDetails>("/api/v1/rooms/schedule", { method: "POST", body: payload }),

  validateRoom: (roomCode: string) =>
    request<RoomDetails>(`/api/v1/rooms/validate/${encodeURIComponent(roomCode)}`),

  getRoom: (roomCode: string) =>
    request<RoomDetails>(`/api/v1/rooms/${encodeURIComponent(roomCode)}`),

  joinRoom: (roomCode: string, body: { display_name?: string; passcode?: string }) =>
    request<RoomDetails>(`/api/v1/rooms/${encodeURIComponent(roomCode)}/join`, {
      method: "POST",
      body,
    }),

  leaveRoom: (roomCode: string) =>
    request<{ ok: boolean }>(`/api/v1/rooms/${encodeURIComponent(roomCode)}/leave`, {
      method: "POST",
      body: {},
    }),

  endRoom: (roomCode: string) =>
    request<RoomDetails>(`/api/v1/rooms/${encodeURIComponent(roomCode)}/end`, {
      method: "POST",
      body: {},
    }),

  getUpcoming: () => request<{ rooms: RoomDetails[] }>("/api/v1/rooms/upcoming"),

  getRecent: () => request<{ rooms: RoomDetails[] }>("/api/v1/rooms/recent"),
};
