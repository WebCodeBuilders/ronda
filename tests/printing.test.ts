import { test } from "node:test";
import assert from "node:assert/strict";
import { formatBill, formatComanda } from "../lib/printing/format";

test("la comanda agrupa por paso y marca notas y lo que sigue", () => {
  const out = formatComanda({
    width: 42, stationName: "Cocina", label: "Mesa 5", ticketNumber: 12, waiterName: "Lucía", guests: 4, createdAt: new Date("2026-11-05T23:00:00Z"),
    items: [
      { quantity: 2, name: "Rabas", modifiers: [], notes: null, course: 1 },
      { quantity: 1, name: "Bife de chorizo", modifiers: [{ name: "Jugoso" }], notes: "sin sal", course: 2, seat: 3 },
    ],
    followUp: ["2 x Flan"],
  });
  assert.match(out, /@@LC Mesa 5/);
  assert.match(out, /-- ENTRADAS --/);
  assert.match(out, /-- PRINCIPALES --/);
  // Letra grande = doble ancho: el renglón se corta a la mitad del papel.
  assert.match(out, /@@L 1 x Bife de chorizo/);
  assert.match(out, /\(P3\)/);
  assert.match(out, /> Jugoso/);
  assert.match(out, /\*\* sin sal \*\*/);
  assert.match(out, /2 x Flan/);
  assert.ok(out.endsWith("@@CUT"));
});

test("ningún renglón de la precuenta se pasa del ancho del papel", () => {
  const out = formatBill({
    width: 32, businessName: "Parador", title: "PRECUENTA", label: "Mesa 5", orderNumber: 99, date: new Date(),
    lines: [{ quantity: 2, name: "Milanesa napolitana con papas fritas y huevo", total: 33800 }],
    subtotal: 33800, discount: 0, serviceCharge: 3000, deliveryFee: 0, total: 36800, suggestedTipPct: 10,
  });
  for (const l of out.split("\n")) {
    const text = l.replace(/^@@[BLC]+ ?/, "");
    if (l.startsWith("@@L") || l === "@@CUT") continue;
    assert.ok(text.length <= 32, `renglón largo: "${text}"`);
  }
  assert.match(out, /Propina sugerida/);
  assert.match(out, /no válido como factura/);
});
