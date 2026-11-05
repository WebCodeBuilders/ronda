"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, MessageCircle, Plus, UserPlus, Users, Armchair } from "lucide-react";
import { Badge, Button, Input, Select, Sheet, Textarea } from "@/components/ui";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { useLiveRefresh } from "@/lib/realtime/client";
import { api } from "@/lib/client/api";
import { CustomerPicker, type PickedCustomer } from "@/components/customers/CustomerPicker";
import { RESERVATION_STATUS_LABEL } from "@/lib/orders/labels";
import { formatTime, cn } from "@/lib/utils";

type R = { id: string; name: string; phone: string | null; partySize: number; dateTime: string; status: string; notes: string | null; quotedMinutes: number | null; areaPreference: string | null; createdAt: string; tableId: string | null; table: string | null };
type T = { id: string; name: string; seats: number; area: string; busy: boolean };

const TONE: Record<string, "accent" | "success" | "warning" | "error" | "neutral" | "info"> = { PENDING: "warning", CONFIRMED: "accent", SEATED: "success", NO_SHOW: "error", CANCELLED: "neutral", DONE: "neutral" };

function shiftDay(day: string, n: number) {
  const d = new Date(`${day}T12:00:00-03:00`);
  d.setDate(d.getDate() + n);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(d);
}

function wa(phone: string, text: string) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits.startsWith("54") ? digits : `549${digits.replace(/^0/, "")}`}?text=${encodeURIComponent(text)}`;
}

export function ReservationsView({ orgName, day, reservations, waitlist, tables }: { orgName: string; day: string; reservations: R[]; waitlist: R[]; tables: T[] }) {
  useLiveRefresh(["reservations.changed", "tables.changed"]);
  const router = useRouter();
  const toast = useToast();
  const [create, setCreate] = useState<null | "RESERVATION" | "WAITLIST">(null);
  const [seat, setSeat] = useState<R | null>(null);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  async function status(r: R, s: string) {
    try {
      await api(`/api/reservations/${r.id}`, { body: { action: "status", status: s } });
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  async function doSeat(tableId: string) {
    if (!seat) return;
    try {
      const r = await api<{ orderId: string }>(`/api/reservations/${seat.id}`, { body: { action: "seat", tableId } });
      router.push(`/pedidos/${r.orderId}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const rawLabel = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
  const label = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);
  const active = reservations.filter((r) => ["PENDING", "CONFIRMED"].includes(r.status));
  const covers = active.reduce((s, r) => s + r.partySize, 0);

  return (
    <PageContainer width="wide">
      <PageHeader title="Reservas" action={<><Button variant="outline" size="sm" icon={<UserPlus className="w-4 h-4" />} onClick={() => setCreate("WAITLIST")}>Lista de espera</Button><Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setCreate("RESERVATION")}>Nueva reserva</Button></>} />
      <div className="grid gap-3 lg:gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <button onClick={() => router.push(`/reservas?dia=${shiftDay(day, -1)}`)} className="tap-44 flex items-center justify-center rounded-xl border border-border bg-surface" aria-label="Día anterior"><ChevronLeft className="w-4 h-4" /></button>
            <div className="flex-1 text-center">
              <p className="text-base font-semibold text-text-primary flex items-center justify-center gap-1.5"><CalendarDays className="w-4 h-4" /> {label}</p>
              <p className="text-xs text-text-muted">{active.length} reservas · {covers} cubiertos</p>
            </div>
            <button onClick={() => router.push(`/reservas?dia=${shiftDay(day, 1)}`)} className="tap-44 flex items-center justify-center rounded-xl border border-border bg-surface" aria-label="Día siguiente"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <div className="rounded-2xl border border-border bg-surface divide-y divide-border">
            {reservations.length === 0 && <p className="px-4 py-10 text-center text-sm text-text-secondary">No hay reservas para este día.</p>}
            {reservations.map((r) => (
              <div key={r.id} className={cn("flex flex-wrap items-center gap-3 px-4 py-3", ["CANCELLED", "NO_SHOW", "DONE"].includes(r.status) && "opacity-60")}>
                <span className="w-14 text-lg font-bold tabular-nums text-text-primary">{formatTime(r.dateTime)}</span>
                <div className="flex-1 min-w-40">
                  <p className="text-sm font-semibold text-text-primary">{r.name} · <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" />{r.partySize}</span>{r.table ? ` · Mesa ${r.table}` : r.areaPreference ? ` · ${r.areaPreference}` : ""}</p>
                  <p className="text-xs text-text-muted">{[r.phone, r.notes].filter(Boolean).join(" · ") || "Sin notas"}</p>
                </div>
                <Badge tone={TONE[r.status]}>{RESERVATION_STATUS_LABEL[r.status]}</Badge>
                {["PENDING", "CONFIRMED"].includes(r.status) && (
                  <div className="flex gap-1.5">
                    <Button size="sm" icon={<Armchair className="w-4 h-4" />} onClick={() => setSeat(r)}>Sentar</Button>
                    {r.status === "PENDING" && <Button size="sm" variant="outline" onClick={() => status(r, "CONFIRMED")}>Confirmar</Button>}
                    <Button size="sm" variant="ghost" onClick={() => status(r, "NO_SHOW")}>No vino</Button>
                    <Button size="sm" variant="ghost" onClick={() => status(r, "CANCELLED")}>Cancelar</Button>
                    {r.phone && <a href={wa(r.phone, `Hola ${r.name}! Te confirmamos la reserva en ${orgName} para ${r.partySize} a las ${formatTime(r.dateTime)}. ¡Te esperamos!`)} target="_blank" rel="noreferrer" className="h-10 lg:h-8 w-10 lg:w-8 rounded-xl border border-border flex items-center justify-center text-success-strong" aria-label="WhatsApp"><MessageCircle className="w-4 h-4" /></a>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-text-primary mb-2 flex items-center gap-1.5"><Clock className="w-4 h-4" /> Lista de espera ({waitlist.length})</h2>
          <div className="rounded-2xl border border-border bg-surface divide-y divide-border">
            {waitlist.length === 0 && <p className="px-4 py-6 text-center text-sm text-text-secondary">Nadie esperando.</p>}
            {waitlist.map((w) => {
              const waited = now ? Math.floor((now - new Date(w.createdAt).getTime()) / 60000) : 0;
              const over = w.quotedMinutes !== null && waited > w.quotedMinutes;
              return (
                <div key={w.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-text-primary">{w.name} · {w.partySize}p</p>
                    <span className={cn("text-xs font-semibold tabular-nums", over ? "text-error" : "text-text-muted")}>{waited} min{w.quotedMinutes ? ` / ${w.quotedMinutes}` : ""}</span>
                  </div>
                  {w.notes && <p className="text-xs text-text-muted">{w.notes}</p>}
                  <div className="flex gap-1.5 mt-2">
                    <Button size="sm" onClick={() => setSeat(w)}>Sentar</Button>
                    {w.phone && <a href={wa(w.phone, `Hola ${w.name}! Tu mesa en ${orgName} ya está lista. Te esperamos.`)} target="_blank" rel="noreferrer" className="h-10 lg:h-8 px-3 rounded-xl border border-border text-xs font-semibold text-success-strong flex items-center gap-1"><MessageCircle className="w-4 h-4" /> Avisar</a>}
                    <Button size="sm" variant="ghost" onClick={() => status(w, "CANCELLED")}>Se fue</Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {create && <CreateSheet kind={create} day={day} tables={tables} onClose={() => setCreate(null)} />}
      {seat && (
        <Sheet open onClose={() => setSeat(null)} title={`Sentar a ${seat.name} (${seat.partySize})`} description="Elegí la mesa. Se abre con la cantidad de personas y las notas de la reserva." maxWidth="max-w-lg">
          {[...new Set(tables.map((t) => t.area))].map((a) => (
            <div key={a} className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">{a}</p>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {tables.filter((t) => t.area === a).map((t) => (
                  <button key={t.id} disabled={t.busy} onClick={() => doSeat(t.id)} className={cn("h-14 rounded-xl border text-sm font-bold flex flex-col items-center justify-center", t.busy ? "opacity-40 border-border" : t.id === seat.tableId ? "border-accent bg-accent-light text-accent" : t.seats >= seat.partySize ? "border-success bg-success-subtle text-success-strong hover:brightness-95" : "border-border hover:bg-surface-secondary")}>
                    {t.name}<span className="text-[10px] font-medium">{t.busy ? "ocupada" : `${t.seats} lug.`}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </Sheet>
      )}
    </PageContainer>
  );
}

function CreateSheet({ kind, day, tables, onClose }: { kind: "RESERVATION" | "WAITLIST"; day: string; tables: T[]; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [customer, setCustomer] = useState<PickedCustomer | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [party, setParty] = useState(2);
  const [date, setDate] = useState(day);
  const [time, setTime] = useState("21:00");
  const [tableId, setTableId] = useState("");
  const [quoted, setQuoted] = useState(20);
  const [notes, setNotes] = useState("");
  async function save() {
    try {
      await api("/api/reservations", {
        body: {
          kind, customerId: customer?.id ?? null, name: name || customer?.name, phone: phone || customer?.phone || null, partySize: party,
          dateTime: kind === "RESERVATION" ? new Date(`${date}T${time}:00-03:00`).toISOString() : undefined,
          tableId: tableId || null, quotedMinutes: kind === "WAITLIST" ? quoted : null, notes: notes || null,
        },
      });
      toast.success(kind === "WAITLIST" ? "Anotado en la lista de espera" : "Reserva guardada");
      router.refresh();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <Sheet open onClose={onClose} title={kind === "WAITLIST" ? "Anotar en lista de espera" : "Nueva reserva"} maxWidth="max-w-md" footer={<Button fullWidth disabled={!(name || customer)} onClick={save}>Guardar</Button>}>
      <div className="space-y-3">
        <CustomerPicker value={customer} onChange={(c) => { setCustomer(c); if (c) { setName(c.name); setPhone(c.phone ?? ""); } }} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <p className="text-sm font-medium mb-1.5">Personas</p>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
              <button key={n} onClick={() => setParty(n)} className={cn("w-11 h-11 rounded-xl border text-sm font-semibold", party === n ? "bg-accent text-white border-accent" : "border-border")}>{n}</button>
            ))}
          </div>
        </div>
        {kind === "RESERVATION" ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Día" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <Input label="Hora" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <Select label="Mesa (opcional)" value={tableId} placeholder="Asignar al llegar" onChange={(e) => setTableId(e.target.value)} options={tables.map((t) => ({ value: t.id, label: `${t.name} · ${t.area} (${t.seats})` }))} />
          </>
        ) : (
          <Input label="Demora estimada (minutos)" type="number" value={quoted} onChange={(e) => setQuoted(Number(e.target.value) || 0)} />
        )}
        <Textarea label="Notas" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Cumpleaños, silla de bebé, celíaco…" />
      </div>
    </Sheet>
  );
}
