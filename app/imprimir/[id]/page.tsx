import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { stripMarks } from "@/lib/printing/escpos";
import { AutoPrint } from "./AutoPrint";

export const metadata = { title: "Imprimir · ronda" };

/**
 * Impresión desde el navegador, para el comercio que no tiene comandera de
 * red: el mismo texto que saldría por la térmica, en un ticket de 80 mm.
 */
export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) notFound();
  const { id } = await params;
  const job = await prisma.printJob.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!job) notFound();
  const lines = job.content.split("\n").filter((l) => l !== "@@CUT" && l !== "@@BEEP");
  return (
    <div className="min-h-dvh bg-white p-4 flex flex-col items-center">
      <AutoPrint jobId={job.id} />
      <div className="rd-ticket">
        {lines.map((l, i) => {
          const m = /^@@([BLC]+) ?/.exec(l);
          const text = stripMarks(l);
          const f = m?.[1] ?? "";
          return (
            <div key={i} style={{ fontWeight: f.includes("B") || f.includes("L") ? 700 : 400, fontSize: f.includes("L") ? 18 : undefined, textAlign: f.includes("C") ? "center" : "left" }}>
              {text || " "}
            </div>
          );
        })}
      </div>
    </div>
  );
}
