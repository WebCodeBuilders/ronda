import { Logo } from "@/components/brand/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <div className="h-1.5" style={{ background: "var(--brand-gradient)" }} />
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        <Logo className="mb-8" />
        {children}
      </div>
    </div>
  );
}
