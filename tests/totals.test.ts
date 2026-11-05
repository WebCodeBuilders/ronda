import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTotals, methodAdjustment, remaining, serviceChargeFor, splitEvenly } from "../lib/orders/totals";

test("suma solo los renglones vivos", () => {
  const t = computeTotals({ items: [{ unitPrice: 1000, quantity: 2, status: "SENT" }, { unitPrice: 500, quantity: 1, status: "VOID" }] });
  assert.equal(t.subtotal, 2000);
  assert.equal(t.total, 2000);
});

test("descuento porcentual + monto fijo, cubierto y envío", () => {
  const t = computeTotals({ items: [{ unitPrice: 10000, quantity: 1, status: "DRAFT" }], discountPct: 10, discountAmount: 500, serviceCharge: 3000, deliveryFee: 1000 });
  assert.equal(t.discount, 1500);
  assert.equal(t.total, 10000 - 1500 + 3000 + 1000);
});

test("el descuento nunca deja la cuenta negativa", () => {
  const t = computeTotals({ items: [{ unitPrice: 1000, quantity: 1, status: "SENT" }], discountPct: 50, discountAmount: 5000 });
  assert.equal(t.discount, 1000);
  assert.equal(t.total, 0);
});

test("partes iguales suman exacto el total", () => {
  const parts = splitEvenly(100, 3);
  assert.deepEqual(parts, [33.34, 33.33, 33.33]);
  assert.equal(Math.round(parts.reduce((s, p) => s + p, 0) * 100) / 100, 100);
});

test("cubierto solo en mesa", () => {
  assert.equal(serviceChargeFor("DINE_IN", 4, 1500), 6000);
  assert.equal(serviceChargeFor("QR", 2, 1500), 3000);
  assert.equal(serviceChargeFor("TAKEAWAY", 4, 1500), 0);
});

test("recargo del medio de pago y saldo", () => {
  assert.equal(methodAdjustment(25900, 10), 2590);
  assert.equal(remaining(51800, 25900), 25900);
  assert.equal(remaining(100, 120), 0);
});
