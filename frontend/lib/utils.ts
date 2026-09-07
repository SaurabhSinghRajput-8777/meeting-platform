// Small formatting helpers.

/**
 * Backend timestamps are naive UTC (SQLite). Parse them as UTC regardless of
 * whether the server included a timezone suffix.
 */
export function parseUtcDate(iso: string): Date {
  return new Date(/Z$|[+\-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`);
}

const AVATAR_GRADIENTS = [
  "from-blue-600 to-indigo-700",
  "from-emerald-600 to-teal-700",
  "from-purple-600 to-pink-700",
  "from-amber-600 to-orange-700",
  "from-rose-600 to-red-700",
  "from-cyan-600 to-blue-700",
  "from-violet-600 to-purple-700",
];

export function nameGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[index];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const date = parseUtcDate(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatTime(iso: string): string {
  const date = parseUtcDate(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function formatDuration(minutes: number | null): string {
  if (!minutes) return "";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

/** Convert a `datetime-local` input value (local time) to a UTC ISO string. */
export function localInputToUtcIso(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date/time");
  return date.toISOString();
}

export function statusLabel(status: string): string {
  switch (status) {
    case "SCHEDULED":
      return "Scheduled";
    case "ACTIVE":
      return "Active";
    case "ENDED":
      return "Ended";
    default:
      return status;
  }
}

export function statusClass(status: string): string {
  switch (status) {
    case "SCHEDULED":
      return "bg-surface-3 text-muted";
    case "ACTIVE":
      return "bg-success/20 text-success";
    case "ENDED":
      return "bg-surface-3 text-muted";
    default:
      return "bg-surface-3 text-muted";
  }
}
