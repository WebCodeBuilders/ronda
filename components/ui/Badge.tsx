import { cn } from "@/lib/utils";

export type Tone = "accent" | "neutral" | "success" | "warning" | "error" | "info" | "violet";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  dot?: boolean;
}

const tones: Record<Tone, string> = {
  accent: "bg-accent-light text-accent",
  neutral: "bg-surface-secondary text-text-secondary",
  success: "bg-success-light text-success-strong",
  warning: "bg-warning-light text-warning-strong",
  error: "bg-error-light text-error-strong",
  info: "bg-info-light text-info-strong",
  violet: "bg-violet-light text-violet-strong",
};

const dotColors: Record<Tone, string> = {
  accent: "bg-accent",
  neutral: "bg-text-muted",
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-error",
  info: "bg-info",
  violet: "bg-violet",
};

/** Chip de estado: lo único que puede ser píldora (no se toca). */
export function Badge({ tone = "neutral", dot, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap", tones[tone], className)}
      {...props}
    >
      {dot && <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColors[tone])} />}
      {children}
    </span>
  );
}
