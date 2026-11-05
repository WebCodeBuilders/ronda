import { prisma } from "@/lib/prisma";
import { requireUser, route } from "@/lib/api";
import { orderLabel } from "@/lib/orders/labels";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const user = await requireUser();
  const orgId = user.organizationId;
  const canSalon = user.permissions.has("salon.view");
  const [requests, readyItems, printFailures] = await Promise.all([
    canSalon
      ? prisma.serviceRequest.findMany({
          where: { organizationId: orgId, status: { in: ["OPEN", "ACK"] } },
          include: { table: { select: { name: true } } },
          orderBy: { createdAt: "asc" },
          take: 30,
        })
      : [],
    canSalon
      ? prisma.orderItem.findMany({
          where: { status: "READY", order: { organizationId: orgId, status: { in: ["OPEN", "BILLING"] }, type: { in: ["DINE_IN", "QR"] } } },
          select: { readyAt: true, order: { select: { id: true, type: true, number: true, waiterId: true, customerName: true, table: { select: { name: true } } } } },
          take: 200,
        })
      : [],
    user.permissions.has("cash.manage") || user.permissions.has("settings.manage")
      ? prisma.printJob.findMany({
          where: { organizationId: orgId, status: "FAILED", createdAt: { gt: new Date(Date.now() - 6 * 3600_000) } },
          select: { id: true, title: true, lastError: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 10,
        })
      : [],
  ]);
  const ready = new Map<string, { orderId: string; label: string; count: number; mine: boolean; readyAt: string }>();
  for (const it of readyItems) {
    const cur = ready.get(it.order.id);
    const at = (it.readyAt ?? new Date()).toISOString();
    if (cur) {
      cur.count++;
      if (at < cur.readyAt) cur.readyAt = at;
    } else ready.set(it.order.id, { orderId: it.order.id, label: orderLabel(it.order), count: 1, mine: it.order.waiterId === user.id, readyAt: at });
  }
  return {
    requests: requests.map((r) => ({ id: r.id, kind: r.kind, tableName: r.table.name, detail: r.detail, createdAt: r.createdAt, status: r.status, orderId: r.orderId })),
    ready: [...ready.values()].sort((a, b) => a.readyAt.localeCompare(b.readyAt)),
    printFailures,
  };
});
