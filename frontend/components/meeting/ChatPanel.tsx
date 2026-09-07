"use client";

import { useEffect, useRef, useState } from "react";
import { SendHorizontal, X } from "lucide-react";
import type { MeetingApi } from "@/hooks/useMeeting";
import { CHAT_MESSAGE_MAX_LENGTH } from "@/lib/config";
import { formatTime } from "@/lib/utils";

export default function ChatPanel({
  meeting,
  onClose,
}: {
  meeting: MeetingApi;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [meeting.messages.length]);

  const submit = () => {
    if (!draft.trim()) return;
    meeting.sendChat(draft);
    setDraft("");
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold">Chat</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-muted transition hover:bg-surface-3 hover:text-white"
          aria-label="Close chat panel"
        >
          <X size={16} />
        </button>
      </header>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {meeting.messages.length === 0 && (
          <p className="mt-8 text-center text-xs text-muted">
            No messages yet. Say hello to everyone!
          </p>
        )}
        {meeting.messages.map((message) => (
          <div key={message.id} className="text-sm">
            <p className="mb-0.5 flex items-baseline gap-2">
              <span className={`font-medium ${message.is_self ? "text-accent" : ""}`}>
                {message.sender_name}
                {message.is_self ? " (You)" : ""}
              </span>
              <span className="text-[10px] text-muted">{formatTime(message.created_at)}</span>
            </p>
            <p className="whitespace-pre-wrap break-words rounded-lg bg-surface-2 px-3 py-2 text-white/90">
              {message.message}
            </p>
          </div>
        ))}
      </div>

      <form
        className="border-t border-line p-3"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value.slice(0, CHAT_MESSAGE_MAX_LENGTH))}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder="Type a message…"
            maxLength={CHAT_MESSAGE_MAX_LENGTH}
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm outline-none transition focus:border-accent"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Send message"
          >
            <SendHorizontal size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}
