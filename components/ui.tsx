import { cn } from "@/lib/cn";

type ButtonVariant = "brass" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const buttonVariants: Record<ButtonVariant, string> = {
  brass:
    "bg-gradient-to-b from-brass-bright via-brass to-brass-dim text-ink font-semibold shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_4px_14px_rgba(0,0,0,0.45)] hover:brightness-110",
  outline:
    "border border-brass-dim/60 text-brass hover:border-brass hover:text-brass-bright hover:bg-brass/5",
  ghost: "text-cream-dim hover:text-cream hover:bg-white/5",
  danger:
    "border border-loss/40 text-loss hover:bg-loss/10 hover:border-loss/70",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export function Button({
  variant = "brass",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md uppercase tracking-[0.12em] transition-all duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed select-none",
        buttonVariants[variant],
        buttonSizes[size],
        className
      )}
      {...props}
    />
  );
}

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border hairline bg-gradient-to-b from-espresso to-coal shadow-[0_10px_40px_rgba(0,0,0,0.5)]",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b hairline px-5 py-4">
      <div>
        <h2 className="font-display text-xl text-brass tracking-wide">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-cream-dim">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "block text-[11px] uppercase tracking-[0.18em] text-cream-dim mb-1.5",
        className
      )}
      {...props}
    />
  );
}

const fieldBase =
  "w-full rounded-md border border-brass-dim/40 bg-ink/70 px-3 text-cream placeholder:text-cream-faint outline-none transition-colors focus:border-brass focus:ring-1 focus:ring-brass/40";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, "h-10 text-sm", className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(fieldBase, "py-2.5 text-sm min-h-[90px] resize-y", className)}
      {...props}
    />
  );
}

export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(fieldBase, "h-10 text-sm appearance-none pr-8", className)}
      {...props}
    />
  );
}

const badgeStyles: Record<string, string> = {
  setup: "border-cream-dim/40 text-cream-dim",
  active: "border-win/50 text-win",
  ended: "border-brass-dim/50 text-brass",
  cashed_out: "border-cream-faint/50 text-cream-faint",
};

export function StatusBadge({ status }: { status: string }) {
  const label =
    status === "setup" ? "Setting up" :
    status === "active" ? "Live" :
    status === "ended" ? "Ended" :
    status === "cashed_out" ? "Cashed out" : status;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-[0.15em]",
        badgeStyles[status] ?? "border-cream-dim/40 text-cream-dim"
      )}
    >
      {status === "active" && (
        <span className="h-1.5 w-1.5 rounded-full bg-win animate-pulse" />
      )}
      {label}
    </span>
  );
}

export function PnL({
  value,
  currency,
  className,
  format,
}: {
  value: number;
  currency: string;
  className?: string;
  format: (v: number, c: string) => string;
}) {
  const tone = value > 0.005 ? "text-win" : value < -0.005 ? "text-loss" : "text-cream-dim";
  return (
    <span className={cn("tabular-nums font-medium", tone, className)}>
      {format(value, currency)}
    </span>
  );
}
