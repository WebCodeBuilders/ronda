"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRightLeft, Ban, BadgePercent, Bike, Combine, MoreHorizontal, Printer, Receipt, RotateCcw, StickyNote, UserRound, Users, UserCog } from "lucide-react";
import { Badge, Button, Input, Select, Sheet, Textarea } from "@/components/ui";
import { CurrencyInput } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useLiveRefresh } from "@/lib/realtime/client";
import { api, ClientApiError } from "@/lib/client/api";
import type { MenuData, MenuProduct, OrderDetail } from "@/lib/orders/queries";
import { FULFILLMENT_LABEL, ORDER_STATUS_LABEL, ORDER_STATUS_TONE, ORDER_TYPE_LABEL, COURSE_LABEL, ITEM_STATUS_LABEL } from "@/lib/orders/labels";
import { formatCurrency, formatQty, formatTime, cn } from "@/lib/utils";
import { MenuPanel } from "./MenuPanel";
import { ProductSheet, type ProductChoice } from "./ProductSheet";
import { TicketPanel } from "./TicketPanel";
import { PaymentSheet, type PayMethod } from "./PaymentSheet";
import { CustomerPicker, type PickedCustomer } from "@/components/customers/CustomerPicker";
import { ManagerPinDialog } from "./ManagerPinDialog";
import { useNavSection } from "@/components/layout/nav-override";
import { useEffect } from "react";

type Item = OrderDetail["items"][number];
type TableOpt = { id: string; name: string; area: string; orderId: string | null; hasPayments: boolean };
type Can = { edit: boolean; send: boolean; void: boolean; discount: boolean; transfer: boolean; charge: boolean; cancel: boolean; reopen: boolean; delivery: boolean };
type Panel = null | "actions" | "pay" | "guests" | "customer" | "waiter" | "transfer" | "merge" | "discount" | "notes" | "cancel" | "reopen" | "delivery";

export function OrderScreen({ order, menu, methods, tables, staff, settings, can }: {
  order: OrderDetail;
  menu: MenuData;
  methods: PayMethod[];
  tables: TableOpt[];
  staff: { id: string; name: string; role: string }[];
  settings: { suggestedTipPct: number; cashOpen: boolean };
  can: Can;
}) {
  useLiveRefresh(["order.changed", "kitchen.changed", "menu.changed"], 20_000);
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<"menu" | "ticket">("menu");
  const [product, setProduct] = useState<MenuProduct | null>(null);
  const [busyProduct, setBusyProduct] = useState<string | null>(null);
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pinRequest, setPinRequest] = useState<null | { title: string; run: (pin: string) => Promise<void> }>(null);

  const active = order.status === "OPEN" || order.status === "BILLING";
  const drafts = order.items.filter((i) => i.status === "DRAFT");
  const label = order.table ? `Mesa ${order.table.name}` : `${ORDER_TYPE_LABEL[order.type]} #${order.number}`;
  const back = order.table ? { href: "/salon", label: "Salón" } : order.fulfillment ? { href: "/delivery", label: "Delivery y retiro" } : { href: "/pedidos", label: "Pedidos" };
  const liveCount = order.items.filter((i) => i.status !== "VOID").reduce((s, i) => s + i.quantity, 0);
  useNavSection(back.href);
  // Cuántos de cada plato hay en la cuenta: se ve sobre la tarjeta de la carta.
  const inOrder: Record<string, number> = {};
  for (const i of order.items) if (i.productId && i.status !== "VOID") inOrder[i.productId] = (inOrder[i.productId] ?? 0) + i.quantity;
  const draftQty = drafts.reduce((s, d) => s + d.quantity, 0);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const minutes = now ? Math.max(0, Math.floor((now - new Date(order.openedAt).getTime()) / 60000)) : null;
  const elapsed = minutes === null ? "" : minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;

  async function run(key: string, fn: () => Promise<unknown>, ok?: string) {
    setBusy(key);
    try {
      await fn();
      if (ok) toast.success(ok);
      router.refresh();
      return true;
    } catch (e) {
      if (e instanceof ClientApiError && e.code === "CASH_CLOSED") toast.error(e.message, "Andá a Caja › Abrir caja.");
      else toast.error((e as Error).message);
      return false;
    } finally {
      setBusy(null);
    }
  }

  /** Corre una acción; si el servidor pide encargado, abre el PIN y reintenta. */
  async function withManager(title: string, fn: (pin?: string) => Promise<unknown>, ok?: string, after?: () => void) {
    setBusy(title);
    try {
      await fn();
      if (ok) toast.success(ok);
      after?.();
      router.refresh();
    } catch (e) {
      if (e instanceof ClientApiError && e.code === "NEEDS_MANAGER") {
        setPinRequest({
          title,
          run: async (pin) => {
            await fn(pin);
            if (ok) toast.success(ok);
            after?.();
            router.refresh();
          },
        });
      } else toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function addProduct(p: MenuProduct) {
    if (!active) return;
    if (p.groups.length > 0 || p.openPrice) {
      setProduct(p);
      return;
    }
    setBusyProduct(p.id);
    await run("add", () => api(`/api/orders/${order.id}`, { body: { action: "addItems", items: [{ productId: p.id, quantity: 1 }] } }));
    setBusyProduct(null);
  }

  async function confirmProduct(c: ProductChoice) {
    const ok = await run("addOpt", () => api(`/api/orders/${order.id}`, { body: { action: "addItems", items: [c] } }));
    if (ok) setProduct(null);
  }

  async function changeQty(i: Item, delta: number) {
    const q = i.quantity + delta;
    setBusyItem(i.id);
    if (q <= 0) await run("del", () => api(`/api/items/${i.id}`, { method: "DELETE" }));
    else await run("qty", () => api(`/api/items/${i.id}`, { method: "PATCH", body: { quantity: q } }));
    setBusyItem(null);
  }

  async function send(holdLater: boolean) {
    await run("send", () => api(`/api/orders/${order.id}`, { body: { action: "send", holdLater } }), holdLater ? "Marchó el primer paso; lo demás queda en espera" : "Marchado a cocina");
  }

  async function bill() {
    setBusy("bill");
    try {
      const r = await api<{ jobId: string; browserPrint: boolean }>(`/api/orders/${order.id}`, { body: { action: "bill" } });
      if (r.browserPrint) window.open(`/imprimir/${r.jobId}`, "_blank", "width=420,height=640");
      else toast.success("Precuenta enviada a la impresora");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function onPaid(closed: boolean) {
    router.refresh();
    if (closed) {
      setPanel(null);
      toast.success(`${label} cobrada y cerrada`);
      if (order.table) router.push("/salon");
    }
  }

  const freeTables = tables.filter((t) => !t.orderId && t.id !== order.table?.id);
  const mergeable = tables.filter((t) => t.orderId && t.orderId !== order.id && !t.hasPayments);

  const footer = (
    <div className="border-t border-border bg-surface p-3 pb-[calc(0.75rem+var(--sa-bottom))] lg:pb-3 space-y-2 shrink-0">
      {active && drafts.length > 0 && can.send ? (
        <div className="flex gap-2">
          <Button className="flex-1" size="lg" loading={busy === "send"} onClick={() => send(false)}>
            Marchar {formatQty(draftQty)}
          </Button>
          {new Set(drafts.filter((d) => d.course > 0).map((d) => d.course)).size > 1 && (
            <Button variant="outline" size="lg" disabled={busy === "send"} onClick={() => send(true)} title="Sale el primer paso; el resto espera tu aviso">
              Por pasos
            </Button>
          )}
        </div>
      ) : active ? (
        <div className="flex gap-2">
          <Button variant="outline" size="lg" className="flex-1" loading={busy === "bill"} onClick={bill} disabled={order.items.length === 0}>
            Precuenta
          </Button>
          {can.charge && (
            <Button size="lg" className="flex-1" onClick={() => (settings.cashOpen ? setPanel("pay") : toast.error("La caja está cerrada", "Abrila en Caja para poder cobrar."))} disabled={order.total <= 0}>
              Cobrar {formatCurrency(order.total - order.paidAmount)}
            </Button>
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" loading={busy === "bill"} onClick={bill}>Reimprimir</Button>
          {order.status === "PAID" && can.reopen && <Button variant="outline" className="flex-1" onClick={() => setPanel("reopen")}>Reabrir</Button>}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)]">
      {/* Encabezado del pedido: qué mesa, cuántos, quién y hace cuánto. */}
      <div className="flex items-center gap-2 px-2 lg:px-4 h-14 border-b border-border bg-surface shrink-0">
        <Link href={back.href} className="tap-44 flex items-center justify-center gap-1 rounded-xl text-sm font-medium text-text-secondary hover:bg-surface-secondary shrink-0 sm:px-2" aria-label={`Volver a ${back.label}`}>
          <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">{back.label}</span>
        </Link>
        <div className="min-w-0 flex-1 flex items-center gap-3">
          <h1 className="text-lg lg:text-xl font-bold tracking-tight text-text-primary truncate">{label}</h1>
          <div className="hidden sm:flex items-center gap-1.5 text-sm text-text-secondary min-w-0">
            <span className="truncate">{order.guests} {order.guests === 1 ? "persona" : "personas"}</span>
            <span className="text-text-muted">·</span>
            <span className="truncate">{order.waiter?.name ?? "Sin mozo"}</span>
            {elapsed && <><span className="text-text-muted">·</span><span className="tabular-nums whitespace-nowrap">{elapsed}</span></>}
            {order.customerName && !order.table && <><span className="text-text-muted">·</span><span className="truncate">{order.customerName}</span></>}
          </div>
          {order.status !== "OPEN" && <Badge tone={ORDER_STATUS_TONE[order.status]}>{ORDER_STATUS_LABEL[order.status]}</Badge>}
          {order.fulfillment && <Badge tone="info" className="hidden md:inline-flex">{FULFILLMENT_LABEL[order.fulfillment]}</Badge>}
        </div>
        <span className="sm:hidden text-xs text-text-secondary tabular-nums whitespace-nowrap">{order.guests}p · {elapsed}</span>
        <button onClick={() => setPanel("actions")} className="tap-44 flex items-center justify-center rounded-xl text-text-secondary hover:bg-surface-secondary" aria-label="Más acciones">
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 min-h-0 lg:grid lg:grid-cols-[minmax(0,1fr)_26rem] xl:grid-cols-[minmax(0,1fr)_28rem]">
        <div className={cn("h-full min-h-0 bg-background", tab === "menu" ? "flex flex-col" : "hidden", "lg:flex lg:flex-col")}>
          {active && can.edit ? (
            <MenuPanel menu={menu} onPick={addProduct} busyId={busyProduct} counts={inOrder} />
          ) : (
            <div className="m-4 rounded-2xl border border-border bg-surface p-6 text-sm text-text-secondary">
              {active ? "No tenés permiso para cargar productos." : order.status === "PAID" ? `Cobrado el ${formatTime(order.closedAt ?? order.openedAt)}. Para cambiar algo hay que reabrirlo.` : `Anulado${order.cancelReason ? `: ${order.cancelReason}` : ""}.`}
            </div>
          )}
          {/* Celular: la cuenta y marchar siempre a mano, sin salir de la carta. */}
          <div className="lg:hidden border-t border-border bg-surface p-3 pb-[calc(0.75rem+var(--sa-bottom))] flex gap-2 shrink-0">
            <Button variant="outline" size="lg" className="flex-1 justify-between" onClick={() => setTab("ticket")}>
              <span>Cuenta{liveCount ? ` (${formatQty(liveCount)})` : ""}</span>
              <span className="tabular-nums">{formatCurrency(order.total)}</span>
            </Button>
            {active && draftQty > 0 && can.send && (
              <Button size="lg" className="flex-1" loading={busy === "send"} onClick={() => send(false)}>Marchar {formatQty(draftQty)}</Button>
            )}
          </div>
        </div>
        <div className={cn("h-full min-h-0 border-l border-border bg-surface", tab === "ticket" ? "flex flex-col" : "hidden", "lg:flex lg:flex-col")}>
          <button onClick={() => setTab("menu")} className="lg:hidden flex items-center gap-1.5 h-11 px-4 border-b border-border text-sm font-semibold text-accent shrink-0">
            <ArrowLeft className="w-4 h-4" /> Seguir cargando
          </button>
          <div className="flex-1 min-h-0 overflow-y-auto scroll-contain">
            <TicketPanel
              order={order}
              onItem={setItem}
              onQty={changeQty}
              busyItem={busyItem}
              canEdit={can.edit}
              canSend={can.send}
              onFireCourse={(c) => run("fire", () => api(`/api/orders/${order.id}`, { body: { action: "fireCourse", course: c } }), `Marchando ${COURSE_LABEL[c]?.toLowerCase() ?? "paso"}`)}
              onServeReady={() => run("serve", () => api(`/api/orders/${order.id}`, { body: { action: "serveReady" } }), "Marcado como entregado")}
            />
          </div>
          {footer}
        </div>
      </div>

      {product && <ProductSheet product={product} guests={order.guests} busy={busy === "addOpt"} onClose={() => setProduct(null)} onConfirm={confirmProduct} />}

      {item && (
        <ItemSheet
          item={item}
          guests={order.guests}
          active={active}
          canEdit={can.edit}
          onClose={() => setItem(null)}
          onSave={(patch) => run("item", () => api(`/api/items/${item.id}`, { method: "PATCH", body: patch })).then((ok) => ok && setItem(null))}
          onVoid={(reason) =>
            withManager("Anular", (pin) => api(`/api/items/${item.id}`, { method: "DELETE", body: { reason, managerPin: pin } }), item.status === "DRAFT" ? undefined : "Anulado. La cocina ya lo sabe.", () => setItem(null))
          }
        />
      )}

      {panel === "pay" && <PaymentSheet order={order} methods={methods} suggestedTipPct={settings.suggestedTipPct} onClose={() => setPanel(null)} onPaid={onPaid} />}

      {panel === "actions" && (
        <Sheet open onClose={() => setPanel(null)} title={label} maxWidth="max-w-sm">
          <div className="-mx-1 divide-y divide-border">
            {active && (
              <>
                <ActionRow icon={Users} label="Comensales" value={String(order.guests)} onClick={() => setPanel("guests")} disabled={!can.edit} />
                <ActionRow icon={UserRound} label="Cliente" value={order.customer?.name ?? "Sin cliente"} onClick={() => setPanel("customer")} disabled={!can.edit} />
                <ActionRow icon={UserCog} label="Mozo" value={order.waiter?.name ?? "—"} onClick={() => setPanel("waiter")} disabled={!can.transfer} />
                <ActionRow icon={StickyNote} label="Nota del pedido" value={order.notes ?? ""} onClick={() => setPanel("notes")} disabled={!can.edit} />
                {order.fulfillment && <ActionRow icon={Bike} label="Entrega" value={FULFILLMENT_LABEL[order.fulfillment]} onClick={() => setPanel("delivery")} disabled={!can.edit} />}
                {order.table && <ActionRow icon={ArrowRightLeft} label="Pasar a otra mesa" onClick={() => setPanel("transfer")} disabled={!can.transfer} />}
                {order.table && <ActionRow icon={Combine} label="Unir con otra mesa" onClick={() => setPanel("merge")} disabled={!can.transfer} />}
                <ActionRow icon={BadgePercent} label="Descuento" value={order.discountPct ? `${order.discountPct} %` : order.discountAmount ? formatCurrency(order.discountAmount) : ""} onClick={() => setPanel("discount")} />
                <ActionRow icon={Printer} label="Imprimir precuenta" onClick={() => { setPanel(null); bill(); }} />
                <ActionRow icon={Ban} label="Anular pedido" danger onClick={() => setPanel("cancel")} />
              </>
            )}
            {!active && (
              <>
                <ActionRow icon={Receipt} label="Reimprimir comprobante" onClick={() => { setPanel(null); bill(); }} />
                {order.status === "PAID" && <ActionRow icon={RotateCcw} label="Reabrir" onClick={() => setPanel("reopen")} disabled={!can.reopen} />}
              </>
            )}
          </div>
        </Sheet>
      )}

      {panel === "guests" && (
        <NumberSheet title="Comensales" initial={order.guests} onClose={() => setPanel(null)} onSave={(n) => run("guests", () => api(`/api/orders/${order.id}`, { body: { action: "update", guests: n } })).then(() => setPanel(null))} />
      )}

      {panel === "customer" && (
        <Sheet open onClose={() => setPanel(null)} title="Cliente del pedido" description="Para su historial, puntos y cuenta corriente." maxWidth="max-w-md">
          <CustomerPicker
            value={order.customer ? { id: order.customer.id, name: order.customer.name, phone: order.customer.phone, balance: order.customer.balance, creditLimit: order.customer.creditLimit } : null}
            onChange={(c: PickedCustomer | null) => run("customer", () => api(`/api/orders/${order.id}`, { body: { action: "update", customerId: c?.id ?? null, ...(order.table ? {} : { customerName: c?.name ?? null, customerPhone: c?.phone ?? null }) } })).then(() => setPanel(null))}
          />
        </Sheet>
      )}

      {panel === "waiter" && (
        <Sheet open onClose={() => setPanel(null)} title="Cambiar mozo" maxWidth="max-w-sm">
          <div className="grid grid-cols-2 gap-2">
            {staff.filter((s) => s.role !== "DELIVERY").map((s) => (
              <button key={s.id} onClick={() => run("waiter", () => api(`/api/orders/${order.id}`, { body: { action: "update", waiterId: s.id } }), `Ahora atiende ${s.name}`).then(() => setPanel(null))} className={cn("min-h-12 px-3 rounded-2xl border text-sm font-semibold text-left", order.waiter?.id === s.id ? "border-accent bg-accent-light text-accent" : "border-border hover:bg-surface-secondary")}>
                {s.name}
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {panel === "notes" && <NotesSheet initial={order.notes ?? ""} onClose={() => setPanel(null)} onSave={(notes) => run("notes", () => api(`/api/orders/${order.id}`, { body: { action: "update", notes: notes || null } })).then(() => setPanel(null))} />}

      {panel === "transfer" && (
        <TablePickSheet title="Pasar a otra mesa" description="Se mueve todo: lo cargado, lo marchado y los cobros." tables={freeTables} onClose={() => setPanel(null)} onPick={(t) => run("transfer", () => api(`/api/orders/${order.id}`, { body: { action: "transfer", tableId: t.id } }), `Pasó a la mesa ${t.name}`).then(() => setPanel(null))} />
      )}
      {panel === "merge" && (
        <TablePickSheet title="Unir con otra mesa" description="Lo de la mesa que elijas pasa a esta cuenta. Esa mesa queda libre." tables={mergeable} onClose={() => setPanel(null)} onPick={(t) => run("merge", () => api(`/api/orders/${order.id}`, { body: { action: "merge", sourceOrderId: t.orderId } }), `Se unió la mesa ${t.name}`).then(() => setPanel(null))} />
      )}

      {panel === "discount" && (
        <DiscountSheet
          order={order}
          onClose={() => setPanel(null)}
          onSave={(pct, amount, reason) => withManager("Descuento", (pin) => api(`/api/orders/${order.id}`, { body: { action: "discount", pct, amount, reason, managerPin: pin } }), "Descuento aplicado", () => setPanel(null))}
        />
      )}

      {panel === "delivery" && <DeliverySheet order={order} staff={staff} canDelivery={can.delivery} onClose={() => setPanel(null)} run={run} />}

      {panel === "cancel" && (
        <ReasonDialog
          title={`Anular ${label}`}
          description={order.items.some((i) => ["SENT", "PREPARING"].includes(i.status)) ? "Lo que está en cocina se anula y la cocina lo ve al instante. Queda en el historial con tu nombre." : "El pedido queda anulado y la mesa se libera. Queda en el historial con tu nombre."}
          confirmLabel="Anular pedido"
          onClose={() => setPanel(null)}
          onConfirm={(reason) => withManager("Anular pedido", (pin) => api(`/api/orders/${order.id}`, { body: { action: "cancel", reason, managerPin: pin } }), "Pedido anulado", () => { setPanel(null); router.push(back.href); })}
        />
      )}
      {panel === "reopen" && (
        <ReasonDialog title={`Reabrir ${label}`} description="Vuelve a estar abierto para agregar o corregir. Queda en el historial." confirmLabel="Reabrir" tone="primary" onClose={() => setPanel(null)} onConfirm={(reason) => run("reopen", () => api(`/api/orders/${order.id}`, { body: { action: "reopen", reason } }), "Reabierto").then(() => setPanel(null))} />
      )}

      {pinRequest && (
        <ManagerPinDialog
          title={pinRequest.title}
          onClose={() => setPinRequest(null)}
          onSubmit={async (pin) => {
            await pinRequest.run(pin);
            setPinRequest(null);
          }}
        />
      )}
    </div>
  );
}

function ActionRow({ label, value, onClick, disabled, danger }: { icon?: unknown; label: string; value?: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className={cn("w-full flex items-center gap-3 px-1 py-3.5 text-left disabled:opacity-40", danger ? "text-error" : "text-text-primary")}>
      <span className="flex-1 text-sm font-medium">{label}</span>
      {value && <span className="text-sm text-text-muted truncate max-w-[45%]">{value}</span>}
    </button>
  );
}

function ItemSheet({ item, guests, active, canEdit, onClose, onSave, onVoid }: {
  item: Item; guests: number; active: boolean; canEdit: boolean; onClose: () => void;
  onSave: (p: { notes: string | null; course: number; seat: number | null }) => void; onVoid: (reason?: string) => void;
}) {
  const draft = item.status === "DRAFT" || item.status === "HOLD";
  const [notes, setNotes] = useState(item.notes ?? "");
  const [course, setCourse] = useState(item.course);
  const [seat, setSeat] = useState<number | null>(item.seat);
  const [reason, setReason] = useState("");
  const reasons = ["Se equivocó el mozo", "El cliente cambió de idea", "Demora", "Salió mal / devuelto", "Invitación de la casa"];
  return (
    <Sheet open onClose={onClose} title={`${formatQty(item.quantity)}× ${item.name}`} description={`${ITEM_STATUS_LABEL[item.status]} · ${formatCurrency(item.total)}`} maxWidth="max-w-md">
      {!active ? (
        <p className="text-sm text-text-secondary">El pedido está cerrado.</p>
      ) : item.status === "VOID" ? (
        <p className="text-sm text-text-secondary">Anulado: {item.voidReason}</p>
      ) : draft ? (
        <div className="space-y-4">
          {item.modifiers.length > 0 && <p className="text-sm text-text-secondary">{item.modifiers.map((m) => m.name).join(" · ")}</p>}
          <Textarea label="Aclaración para la cocina" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={item.status !== "DRAFT"} />
          {item.status === "DRAFT" && (
            <div className="flex flex-wrap gap-2">
              {[0, 1, 2, 3, 4].map((c) => (
                <button key={c} onClick={() => setCourse(c)} className={cn("h-10 px-3 rounded-xl border text-sm font-medium", course === c ? "border-accent bg-accent-light text-accent" : "border-border text-text-secondary")}>{COURSE_LABEL[c]}</button>
              ))}
            </div>
          )}
          {guests > 1 && (
            <Select label="Comensal" value={seat ? String(seat) : ""} onChange={(e) => setSeat(e.target.value ? Number(e.target.value) : null)} placeholder="Compartido" options={Array.from({ length: guests }, (_, i) => ({ value: String(i + 1), label: `Comensal ${i + 1}` }))} />
          )}
          <div className="flex gap-2 pt-1">
            <Button variant="danger-outline" onClick={() => onVoid()} disabled={!canEdit}>Quitar</Button>
            <Button className="flex-1" onClick={() => onSave({ notes: notes.trim() || null, course, seat })} disabled={!canEdit}>Guardar</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-text-secondary">Ya está en {item.station ?? "cocina"}. Para cambiarlo, anulalo (la cocina lo ve tachado y sale el aviso por la comandera) y cargalo de nuevo.</p>
          <div className="flex flex-wrap gap-2">
            {reasons.map((r) => (
              <button key={r} onClick={() => setReason(r)} className={cn("h-9 px-3 rounded-xl border text-xs font-medium", reason === r ? "border-error bg-error-light text-error-strong" : "border-border text-text-secondary")}>{r}</button>
            ))}
          </div>
          <Input label="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Escribí o elegí uno" />
          <Button variant="danger" fullWidth disabled={!reason.trim() || !canEdit} onClick={() => onVoid(reason.trim())}>Anular {formatQty(item.quantity)}× {item.name}</Button>
        </div>
      )}
    </Sheet>
  );
}

function NumberSheet({ title, initial, onClose, onSave }: { title: string; initial: number; onClose: () => void; onSave: (n: number) => void }) {
  const [n, setN] = useState(initial);
  return (
    <Sheet open onClose={onClose} title={title} maxWidth="max-w-sm" footer={<Button fullWidth onClick={() => onSave(n)}>Guardar</Button>}>
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: 15 }, (_, i) => i + 1).map((k) => (
          <button key={k} onClick={() => setN(k)} className={cn("h-12 rounded-xl border text-base font-semibold tabular-nums", n === k ? "bg-accent text-white border-accent" : "border-border")}>{k}</button>
        ))}
      </div>
      <Input className="mt-3" type="number" min={1} value={n} onChange={(e) => setN(Math.max(1, Number(e.target.value) || 1))} label="Otro número" />
    </Sheet>
  );
}

function NotesSheet({ initial, onClose, onSave }: { initial: string; onClose: () => void; onSave: (s: string) => void }) {
  const [v, setV] = useState(initial);
  return (
    <Sheet open onClose={onClose} title="Nota del pedido" description="Sale en todas las comandas (alergias, festejo, apuro)." maxWidth="max-w-md" footer={<Button fullWidth onClick={() => onSave(v.trim())}>Guardar</Button>}>
      <Textarea rows={3} value={v} onChange={(e) => setV(e.target.value)} placeholder="Ej.: celíaco en la mesa, cumpleaños con vela al postre" />
    </Sheet>
  );
}

function TablePickSheet({ title, description, tables, onClose, onPick }: { title: string; description: string; tables: TableOpt[]; onClose: () => void; onPick: (t: TableOpt) => void }) {
  const areas = [...new Set(tables.map((t) => t.area))];
  return (
    <Sheet open onClose={onClose} title={title} description={description} maxWidth="max-w-lg">
      {tables.length === 0 ? (
        <p className="text-sm text-text-secondary">No hay mesas disponibles.</p>
      ) : (
        <div className="space-y-4">
          {areas.map((a) => (
            <div key={a}>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">{a}</p>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {tables.filter((t) => t.area === a).map((t) => (
                  <button key={t.id} onClick={() => onPick(t)} className="h-12 rounded-xl border border-border text-sm font-bold tabular-nums hover:bg-accent-light hover:border-accent hover:text-accent">{t.name}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}

function DiscountSheet({ order, onClose, onSave }: { order: OrderDetail; onClose: () => void; onSave: (pct: number, amount: number, reason: string | null) => void }) {
  const [pct, setPct] = useState(order.discountPct);
  const [amount, setAmount] = useState<number | null>(order.discountAmount || null);
  const [reason, setReason] = useState(order.discountReason ?? "");
  return (
    <Sheet open onClose={onClose} title="Descuento" description="Queda en el historial con quién lo hizo y por qué." maxWidth="max-w-sm" footer={<Button fullWidth onClick={() => onSave(pct, amount ?? 0, reason.trim() || null)}>Aplicar</Button>}>
      <div className="space-y-4">
        <div className="grid grid-cols-5 gap-2">
          {[0, 5, 10, 15, 20, 25, 30, 50, 100].map((p) => (
            <button key={p} onClick={() => setPct(p)} className={cn("h-11 rounded-xl border text-sm font-semibold tabular-nums", pct === p ? "bg-accent text-white border-accent" : "border-border")}>{p === 0 ? "0" : `${p}%`}</button>
          ))}
        </div>
        <div>
          <p className="text-sm font-medium mb-1.5">Monto fijo (además del %)</p>
          <CurrencyInput value={amount} onChange={setAmount} />
        </div>
        <Input label="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Cliente frecuente, demora, invitación…" />
      </div>
    </Sheet>
  );
}

function DeliverySheet({ order, staff, canDelivery, onClose, run }: { order: OrderDetail; staff: { id: string; name: string; role: string }[]; canDelivery: boolean; onClose: () => void; run: (k: string, fn: () => Promise<unknown>, ok?: string) => Promise<boolean> }) {
  const [name, setName] = useState(order.customerName ?? "");
  const [phone, setPhone] = useState(order.customerPhone ?? "");
  const [address, setAddress] = useState(order.deliveryAddress ?? "");
  const [fee, setFee] = useState<number | null>(order.deliveryFee || null);
  return (
    <Sheet
      open
      onClose={onClose}
      title="Entrega"
      maxWidth="max-w-md"
      footer={
        <Button fullWidth onClick={() => run("delivery", () => api(`/api/orders/${order.id}`, { body: { action: "update", customerName: name || null, customerPhone: phone || null, deliveryAddress: order.type === "DELIVERY" ? address || null : undefined, deliveryFee: order.type === "DELIVERY" ? fee ?? 0 : undefined } }), "Guardado").then((ok) => ok && onClose())}>
          Guardar
        </Button>
      }
    >
      <div className="space-y-3">
        <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} />
        {order.type === "DELIVERY" && (
          <>
            <Input label="Dirección" value={address} onChange={(e) => setAddress(e.target.value)} />
            <div>
              <p className="text-sm font-medium mb-1.5">Costo de envío</p>
              <CurrencyInput value={fee} onChange={setFee} />
            </div>
            {canDelivery && (
              <Select
                label="Repartidor"
                value={order.courier?.id ?? ""}
                placeholder="Sin asignar"
                onChange={(e) => run("courier", () => api(`/api/orders/${order.id}`, { body: { action: "fulfillment", step: order.fulfillment ?? "PENDING", courierId: e.target.value || null } }), "Repartidor asignado")}
                options={staff.filter((s) => s.role === "DELIVERY" || s.role === "WAITER").map((s) => ({ value: s.id, label: s.name }))}
              />
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}

function ReasonDialog({ title, description, confirmLabel, tone = "danger", onClose, onConfirm }: { title: string; description: string; confirmLabel: string; tone?: "danger" | "primary"; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <ConfirmDialog title={title} confirmLabel={confirmLabel} tone={tone} onClose={onClose} onConfirm={() => reason.trim() && onConfirm(reason.trim())}>
      <p className="mb-3">{description}</p>
      <Input label="Motivo (obligatorio)" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
    </ConfirmDialog>
  );
}
