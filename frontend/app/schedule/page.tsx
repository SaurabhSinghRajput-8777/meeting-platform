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
      <div className="flex min-h-screen items-center justify-center bg-bg p-4">
        <div className="w-full max-w-md rounded-2xl bg-surface p-8 text-center">
          <CheckCircle2 size={40} className="mx-auto text-success" />
          <h1 className="mt-4 text-lg font-semibold">Meeting scheduled</h1>
          <p className="mt-1 text-sm text-muted">{scheduled.title}</p>
          <dl className="mt-6 space-y-2 rounded-xl bg-surface-2 p-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">When</dt>
              <dd>{formatDateTime(scheduled.scheduled_for)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Duration</dt>
              <dd>{formatDuration(scheduled.duration_minutes)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Meeting ID</dt>
              <dd className="font-mono">{scheduled.room_code}</dd>
            </div>
          </dl>
          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => void copyInvite(scheduled)}
              className="flex items-center justify-center gap-2 rounded-lg bg-surface-3 py-2.5 text-sm font-medium transition hover:bg-line"
            >
              <Copy size={14} /> Copy invite link
            </button>
            <Link
              href="/"
              className="rounded-lg bg-accent py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-2xl items-center px-4 py-3">
          <Link href="/" className="flex items-center gap-2 text-sm text-muted transition hover:text-white">
            <ArrowLeft size={16} /> Back to dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <CalendarPlus size={20} className="text-accent" /> Schedule a meeting
        </h1>

        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="mt-6 space-y-5 rounded-2xl bg-surface p-6"
        >
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
              Title *
            </span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={100}
              placeholder="e.g. Team sync"
              className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-sm outline-none transition focus:border-accent"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
                Date *
              </span>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-sm outline-none transition focus:border-accent"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
                Time *
              </span>
              <input
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-sm outline-none transition focus:border-accent"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
                Duration
              </span>
              <select
                value={duration}
                onChange={(event) => setDuration(Number(event.target.value))}
                className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-sm outline-none transition focus:border-accent"
              >
                {DURATIONS.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {formatDuration(minutes)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
              Description
            </span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="Optional agenda or notes"
              className="w-full resize-none rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-sm outline-none transition focus:border-accent"
            />
          </label>

          <div className="rounded-lg bg-surface-2 p-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={usePasscode}
                onChange={(event) => setUsePasscode(event.target.checked)}
                className="h-4 w-4 accent-[#3b82f6]"
              />
              Require a passcode
            </label>
            {usePasscode && (
              <input
                type="text"
                value={passcode}
                onChange={(event) => setPasscode(event.target.value)}
                maxLength={12}
                placeholder="4–12 characters"
                className="mt-3 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none transition focus:border-accent"
              />
            )}
            <p className="mt-2 text-xs text-muted">
              Passcodes are hashed (PBKDF2) before storage and verified on join.
            </p>
          </div>

          {error && <p className="rounded-lg bg-danger/15 px-3 py-2 text-sm text-danger">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-accent py-3 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Scheduling…" : "Schedule meeting"}
          </button>
        </form>
      </main>
    </div>
  );
}
