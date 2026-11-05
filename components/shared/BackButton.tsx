import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface BackButtonProps {
  href: string;
  label?: string;
}

export function BackButton({ href, label = "Configuración" }: BackButtonProps) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-sm font-medium mb-5 px-3 py-1.5 -ml-3 rounded-2xl transition-colors text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
    >
      <ArrowLeft className="w-4 h-4" />
      {label}
    </Link>
  );
}
