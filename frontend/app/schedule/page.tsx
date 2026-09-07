"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarPlus, CheckCircle2, Copy } from "lucide-react";
import { api, ApiError } from "@/services/api";
import { formatDateTime, formatDuration, localInputToUtcIso } from "@/lib/utils";
import type { RoomDetails } from "@/types";

const DURATIONS = [15, 30, 45, 60, 90, 120];

export default function SchedulePage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState(30);
  const [passcode, setPasscode] = useState("");
  const [usePasscode, setUsePasscode] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scheduled, setScheduled] = useState<RoomDetails | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    // Client-side validation (PRD §14); the server validates again.
    if (!title.trim()) {
      setError("Please enter a meeting title.");
      return;
    }
    if (!date || !time) {
      setError("Please choose a date and time.");
      return;
    }
    const scheduledFor = new Date(`${date}T${time}`);
    if (Number.isNaN(scheduledFor.getTime())) {
      setError("Please enter a valid date and time.");
      return;
    }
    if (scheduledFor.getTime() <= Date.now()) {
      setError("The scheduled time must be in the future.");
      return;
    }
    if (usePasscode && (passcode.length < 4 || passcode.length > 12)) {
      setError("The passcode must be 4–12 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const room = await api.scheduleMeeting({
        title: title.trim(),
        description: description.trim() || undefined,
        scheduled_for: localInputToUtcIso(`${date}T${time}`),
        duration_minutes: duration,
        passcode: usePasscode ? passcode : undefined,
      });
      setScheduled(room);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not schedule the meeting.");
    } finally {
      setSubmitting(false);
    }
  };

  const copyInvite = async (room: RoomDetails) => {
    const link = `${window.location.origin}/meeting/${room.room_code}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      window.prompt("Copy this invite link:", link);
    }
  };

  if (scheduled) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#121214] text-white p-4">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1c1c20] p-8 text-center shadow-2xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 size={36} />
          </div>
          <h1 className="mt-4 text-xl font-bold tracking-tight text-white/95">Meeting Scheduled</h1>
          <p className="mt-1 text-xs text-white/50">{scheduled.title}</p>
          <dl className="mt-6 space-y-2.5 rounded-xl border border-white/5 bg-[#242429] p-4 text-xs">
            <div className="flex justify-between gap-4">
              <dt className="text-white/50">When</dt>
              <dd className="font-medium text-white/90">{formatDateTime(scheduled.scheduled_for)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-white/50">Duration</dt>
              <dd className="font-medium text-white/90">{formatDuration(scheduled.duration_minutes)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-white/50">Meeting ID</dt>
              <dd className="font-mono font-semibold text-[#0e72ed]">{scheduled.room_code}</dd>
            </div>
          </dl>
          <div className="mt-6 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => void copyInvite(scheduled)}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-semibold text-white/90 transition hover:bg-white/10"
            >
              <Copy size={14} /> Copy invite link
            </button>
            <Link
              href="/"
              className="rounded-xl bg-[#0e72ed] py-2.5 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-[#1a7cf7]"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121214] text-white">
      <header className="border-b border-white/10 bg-[#18181c]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center px-6 py-3.5">
          <Link href="/" className="flex items-center gap-2 text-xs font-medium text-white/60 transition hover:text-white">
            <ArrowLeft size={14} /> Back to dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-8">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0e72ed] text-white shadow-md shadow-blue-500/25">
            <CalendarPlus size={20} />
          </span>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white/95">Schedule a Meeting</h1>
            <p className="text-xs text-white/50">Plan and invite attendees in advance</p>
          </div>
        </div>

        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="space-y-5 rounded-2xl border border-white/10 bg-[#18181c] p-6 shadow-xl"
        >
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-white/70">
              Meeting Topic / Title <span className="text-rose-400">*</span>
            </span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={100}
              placeholder="e.g. Team sync"
              className="w-full rounded-xl border border-white/15 bg-[#232328] px-3.5 py-2.5 text-xs text-white placeholder-white/40 outline-none transition focus:border-[#0e72ed] focus:ring-1 focus:ring-[#0e72ed]"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-white/70">
                Date <span className="text-rose-400">*</span>
              </span>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="w-full rounded-xl border border-white/15 bg-[#232328] px-3.5 py-2 text-xs text-white outline-none transition focus:border-[#0e72ed] focus:ring-1 focus:ring-[#0e72ed]"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-white/70">
                Time <span className="text-rose-400">*</span>
              </span>
              <input
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                className="w-full rounded-xl border border-white/15 bg-[#232328] px-3.5 py-2 text-xs text-white outline-none transition focus:border-[#0e72ed] focus:ring-1 focus:ring-[#0e72ed]"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-white/70">
                Duration
              </span>
              <select
                value={duration}
                onChange={(event) => setDuration(Number(event.target.value))}
                className="w-full rounded-xl border border-white/15 bg-[#232328] px-3.5 py-2 text-xs text-white outline-none transition focus:border-[#0e72ed] focus:ring-1 focus:ring-[#0e72ed]"
              >
                {DURATIONS.map((minutes) => (
                  <option key={minutes} value={minutes} className="bg-[#232328] text-white">
                    {formatDuration(minutes)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-white/70">
              Description / Agenda
            </span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="Optional agenda or notes"
              className="w-full resize-none rounded-xl border border-white/15 bg-[#232328] px-3.5 py-2.5 text-xs text-white placeholder-white/40 outline-none transition focus:border-[#0e72ed] focus:ring-1 focus:ring-[#0e72ed]"
            />
          </label>

          <div className="rounded-xl border border-white/10 bg-[#222227] p-4">
            <label className="flex items-center gap-2.5 text-xs font-medium text-white/90 cursor-pointer">
              <input
                type="checkbox"
                checked={usePasscode}
                onChange={(event) => setUsePasscode(event.target.checked)}
                className="h-4 w-4 rounded accent-[#0e72ed]"
              />
              Require a meeting passcode
            </label>
            {usePasscode && (
              <input
                type="text"
                value={passcode}
                onChange={(event) => setPasscode(event.target.value)}
                maxLength={12}
                placeholder="4–12 characters"
                className="mt-3 w-full rounded-xl border border-white/15 bg-[#18181c] px-3.5 py-2 text-xs text-white placeholder-white/40 outline-none transition focus:border-[#0e72ed] focus:ring-1 focus:ring-[#0e72ed]"
              />
            )}
            <p className="mt-2 text-[11px] text-white/40">
              Passcodes are securely hashed (PBKDF2) before storage and verified on entry.
            </p>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-[#0e72ed] py-3 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-[#1a7cf7] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Scheduling…" : "Schedule Meeting"}
          </button>
        </form>
      </main>
    </div>
  );
}
