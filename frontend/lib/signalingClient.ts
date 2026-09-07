import type { ClientMessage, ServerMessage } from "@/types";

export type SignalingStatus = "connecting" | "open" | "closed";

/**
 * Thin wrapper around the native WebSocket used for the signaling channel.
 * Signaling carries SDP/ICE and real-time events only — never media (PRD §18).
 */
export class SignalingClient {
  private ws: WebSocket | null = null;
  private closedByUs = false;

  constructor(
    private readonly onMessage: (message: ServerMessage) => void,
    private readonly onStatusChange: (status: SignalingStatus) => void,
  ) {}

  connect(url: string): void {
    this.closedByUs = false;
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => this.onStatusChange("open");
    ws.onmessage = (event) => {
      try {
        this.onMessage(JSON.parse(event.data as string) as ServerMessage);
      } catch {
        // ignore malformed frames
      }
    };
    ws.onclose = () => this.onStatusChange("closed");
    ws.onerror = () => {
      /* onclose always follows onerror */
    };
  }

  send(message: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  close(): void {
    this.closedByUs = true;
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // already closed
      }
    }
  }

  get wasClosedByUs(): boolean {
    return this.closedByUs;
  }
}
