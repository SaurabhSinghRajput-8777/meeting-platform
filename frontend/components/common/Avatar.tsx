import { initials } from "@/lib/utils";

export default function Avatar({
  name,
  size = "md",
  className = "",
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClass =
    size === "sm" ? "h-8 w-8 text-xs" : size === "lg" ? "h-20 w-20 text-2xl" : "h-12 w-12 text-base";
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-accent/20 font-semibold text-accent ${sizeClass} ${className}`}
      aria-hidden
    >
      {initials(name)}
    </div>
  );
}
