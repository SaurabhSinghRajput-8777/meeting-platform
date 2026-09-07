"use client";

import { useEffect, useRef, useState } from "react";
import { SendHorizontal, Users, X } from "lucide-react";
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
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [meeting.messages.length]);

  const submit = () => {
    if (!draft.trim()) return;
    meeting.sendChat(draft);
    setDraft("");
  };

  return (
    <div className="flex h-full flex-col bg-[#1c1c20] text-white select-none">
      {/* Zoom-style Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold tracking-tight text-white/90">Meeting Chat</h2>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/70">
            {meeting.messages.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white"
          aria-label="Close chat panel"
        >
          <X size={15} />
        </button>
      </header>

      {/* Messages Stream */}
      <div ref={listRef} className="flex-1 space-y-3.5 overflow-y-auto p-4 select-text">
        {meeting.messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-white/40 mb-3">
              <Users size={22} />
            </div>
            <p className="text-xs font-medium text-white/70">No messages yet</p>
            <p className="mt-1 text-[11px] text-white/40 max-w-[200px]">
              Chat messages are visible to everyone in this meeting room.
            </p>
          </div>
        ) : (
          meeting.messages.map((message) => {
            const isSelf = message.is_self;
            return (
              <div
                key={message.id}
                className={`flex flex-col text-xs ${isSelf ? "items-end" : "items-start"}`}
              >
                {/* Sender line (Zoom: From Sender to Everyone: Time) */}
                <div className="mb-1 flex items-center gap-1.5 px-1 text-[11px] text-white/50">
                  <span>From</span>
                  <span className={`font-semibold ${isSelf ? "text-emerald-400" : "text-sky-400"}`}>
                    {isSelf ? "You" : message.sender_name}
                  </span>
                  <span>to</span>
                  <span className="text-white/70">Everyone</span>
                  <span className="text-[10px] opacity-70">({formatTime(message.created_at)})</span>
                </div>

                {/* Message bubble */}
                <div
                  className={`max-w-[85%] whitespace-pre-wrap break-words px-3.5 py-2.5 text-[13px] leading-relaxed shadow-sm ${
                    isSelf
                      ? "rounded-2xl rounded-tr-sm bg-[#0e72ed] text-white"
                      : "rounded-2xl rounded-tl-sm bg-[#27272c] border border-white/5 text-white/95"
                  }`}
                >
                  {message.message}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-white/10 bg-[#18181c] p-3.5">
        {/* Zoom's "To: Everyone" selector */}
        <div className="mb-2 flex items-center gap-1.5 text-[11px] text-white/50 px-1">
          <span>To:</span>
          <span className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 font-medium text-white/80">
            <Users size={11} className="text-emerald-400" />
            Everyone
          </span>
        </div>

        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
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
            className="min-w-0 flex-1 rounded-xl border border-white/15 bg-[#232328] px-3.5 py-2.5 text-xs text-white placeholder-white/40 outline-none transition focus:border-[#0e72ed] focus:ring-1 focus:ring-[#0e72ed]"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0e72ed] text-white transition hover:bg-[#1a7cf7] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[#0e72ed]"
            aria-label="Send message"
          >
            <SendHorizontal size={15} />
          </button>
        </form>
        <p className="mt-1.5 px-1 text-[10px] text-white/30 text-right">Press Enter to send</p>
      </div>
    </div>
  );
}

