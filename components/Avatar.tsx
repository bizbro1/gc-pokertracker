import { cn } from "@/lib/cn";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export function Avatar({
  name,
  url,
  className,
}: {
  name: string;
  url?: string;
  className?: string;
}) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        className={cn(
          "rounded-full object-cover border border-brass-dim/50 shadow-[0_2px_8px_rgba(0,0,0,0.5)]",
          className
        )}
      />
    );
  }
  return (
    <span
      className={cn(
        "flex items-center justify-center rounded-full border border-brass-dim/50 bg-gradient-to-b from-leather-light to-leather text-brass-bright font-semibold select-none",
        className
      )}
      title={name}
    >
      {initials(name)}
    </span>
  );
}
