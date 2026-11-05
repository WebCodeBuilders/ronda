import { cn } from "@/lib/utils";

/**
 * Isotipo de ronda: una mesa vista desde arriba con su ronda de sillas.
 * Usa `currentColor`, así toma el color del contexto (acento en claro, blanco
 * sobre el sidebar oscuro).
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={cn("w-8 h-8", className)} aria-hidden>
      <circle cx="16" cy="16" r="7" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="16" cy="4.5" r="2.5" fill="currentColor" />
      <circle cx="27.5" cy="16" r="2.5" fill="currentColor" />
      <circle cx="16" cy="27.5" r="2.5" fill="currentColor" />
      <circle cx="4.5" cy="16" r="2.5" fill="currentColor" opacity="0.45" />
    </svg>
  );
}

export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", light ? "text-white" : "text-accent", className)}>
      <LogoMark className="w-7 h-7" />
      <span className="text-xl font-bold tracking-tight">ronda</span>
    </span>
  );
}
