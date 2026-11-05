/**
 * Eventos que viajan entre terminales. Son AVISOS, no datos: dicen "cambió el
 * pedido X" y cada pantalla vuelve a pedir lo que necesita. Así nunca hay dos
 * versiones de la verdad.
 */
export type RealtimeEvent =
  | { type: "order.changed"; orderId: string; tableId?: string | null }
  | { type: "tables.changed" }
  | { type: "kitchen.changed"; stationIds?: string[] }
  | { type: "ticket.ready"; orderId: string; ticketId: string; label: string; waiterId?: string | null; stationName: string }
  | { type: "request.new"; requestId: string; tableName: string; kind: string }
  | { type: "request.changed" }
  | { type: "menu.changed" }
  | { type: "cash.changed" }
  | { type: "print.failed"; jobId: string; title: string; error: string }
  | { type: "reservations.changed" }
  | { type: "resync" };

export type RealtimeEventType = RealtimeEvent["type"];
