import { initials, nameGradient } from "@/lib/utils";

export default function Avatar({
  name,
  size = "md",
  className = "",
}: {
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const sizeClass =
    size === "sm"
      ? "h-8 w-8 text-xs font-semibold"
      : size === "lg"
        ? "h-20 w-20 text-2xl font-bold shadow-2xl ring-4 ring-white/10"
        : size === "xl"
          ? "h-28 w-28 text-4xl font-bold shadow-2xl ring-4 ring-white/10"
          : "h-11 w-11 text-sm font-semibold shadow-md ring-2 ring-white/10";
  const gradient = nameGradient(name);
  return (
    <div
      className={`flex shrink-0 select-none items-center justify-center rounded-full bg-gradient-to-br ${gradient} text-white transition-transform ${sizeClass} ${className}`}
      aria-hidden
    >
      {initials(name)}
    </div>
  );
}
