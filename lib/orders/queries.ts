import "server-only";
import { prisma } from "@/lib/prisma";

export type MenuProduct = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  categoryId: string | null;
  available: boolean;
  openPrice: boolean;
  course: number;
  imageUrl: string | null;
  tags: string[];
  groups: { id: string; name: string; min: number; max: number; options: { id: string; name: string; priceDelta: number; available: boolean }[] }[];
};

export type MenuData = {
  categories: { id: string; name: string; color: string }[];
  products: MenuProduct[];
};

/** La carta para cargar pedidos (caja, mozo, mostrador). */
export async function loadMenu(orgId: string, opts: { qrOnly?: boolean } = {}): Promise<MenuData> {
  const [categories, products] = await Promise.all([
    prisma.category.findMany({ where: { organizationId: orgId, active: true }, orderBy: { sort: "asc" }, select: { id: true, name: true, color: true } }),
    prisma.product.findMany({
      where: { organizationId: orgId, active: true, ...(opts.qrOnly ? { showInQrMenu: true } : {}) },
      orderBy: [{ sort: "asc" }, { name: "asc" }],
      include: { modifierGroups: { orderBy: { sort: "asc" }, include: { group: { include: { options: { orderBy: { sort: "asc" } } } } } } },
    }),
  ]);
  return {
    categories,
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price,
      categoryId: p.categoryId,
      available: p.available,
      openPrice: p.openPrice,
      course: p.course,
      imageUrl: p.imageUrl,
      tags: p.tags,
      groups: p.modifierGroups.map((mg) => ({
        id: mg.group.id,
        name: mg.group.name,
        min: mg.group.minSelect,
        max: mg.group.maxSelect,
        options: mg.group.options.map((o) => ({ id: o.id, name: o.name, priceDelta: o.priceDelta, available: o.available })),
      })),
    })),
  };
}

export async function loadOrderDetail(orgId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, organizationId: orgId },
    include: {
      table: { include: { area: { select: { name: true } } } },
      waiter: { select: { id: true, name: true, color: true } },
      courier: { select: { id: true, name: true } },
      customer: { select: { id: true, name: true, phone: true, notes: true, balance: true, creditLimit: true, points: true } },
      items: { orderBy: [{ createdAt: "asc" }], include: { station: { select: { name: true } } } },
      payments: { orderBy: { createdAt: "asc" }, include: { method: { select: { name: true, kind: true } }, createdBy: { select: { name: true } } } },
      tickets: { select: { id: true, number: true, status: true, createdAt: true, stationId: true } },
    },
  });
  if (!order) return null;
  return {
    id: order.id,
    number: order.number,
    type: order.type,
    status: order.status,
    fulfillment: order.fulfillment,
    source: order.source,
    guests: order.guests,
    notes: order.notes,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    deliveryAddress: order.deliveryAddress,
    deliveryFee: order.deliveryFee,
    subtotal: order.subtotal,
    discountPct: order.discountPct,
    discountAmount: order.discountAmount,
    discountReason: order.discountReason,
    serviceCharge: order.serviceCharge,
    tip: order.tip,
    total: order.total,
    paidAmount: order.paidAmount,
    openedAt: order.openedAt.toISOString(),
    closedAt: order.closedAt?.toISOString() ?? null,
    billPrintedAt: order.billPrintedAt?.toISOString() ?? null,
    cancelReason: order.cancelReason,
    table: order.table ? { id: order.table.id, name: order.table.name, area: order.table.area.name } : null,
    waiter: order.waiter,
    courier: order.courier,
    customer: order.customer,
    items: order.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      name: i.name,
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      total: i.total,
      modifiers: (i.modifiers as { groupName: string; name: string; priceDelta: number }[]) ?? [],
      notes: i.notes,
      course: i.course,
      seat: i.seat,
      status: i.status,
      station: i.station?.name ?? null,
      sentAt: i.sentAt?.toISOString() ?? null,
      readyAt: i.readyAt?.toISOString() ?? null,
      voidReason: i.voidReason,
      paidQty: i.paidQty,
    })),
    payments: order.payments.map((p) => ({
      id: p.id,
      method: p.method.name,
      kind: p.method.kind,
      amount: p.amount,
      tip: p.tip,
      surcharge: p.surcharge,
      change: p.change,
      reference: p.reference,
      by: p.createdBy?.name ?? null,
      createdAt: p.createdAt.toISOString(),
    })),
  };
}

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof loadOrderDetail>>>;
