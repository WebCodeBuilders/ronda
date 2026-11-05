import Link from "next/link";
import { buttonClasses } from "@/components/ui/button-styles";
import { LogoMark } from "@/components/brand/Logo";

export default function NotFound() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-3 px-4 text-center bg-background">
      <LogoMark className="w-10 h-10 text-accent" />
      <h1 className="text-xl font-bold text-text-primary">No encontramos esta página</h1>
      <p className="text-sm text-text-secondary max-w-sm">Puede que el pedido, el cliente o el QR ya no exista, o que el enlace esté mal escrito.</p>
      <Link href="/" className={buttonClasses({}, "mt-2")}>Ir al inicio</Link>
    </div>
  );
}
