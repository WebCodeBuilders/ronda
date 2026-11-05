import { test } from "node:test";
import assert from "node:assert/strict";
import { tableState } from "../lib/salon/state";

const base = { hasOrder: true, orderStatus: "OPEN", readyItems: 0, draftItems: 0, oldestPendingSentAt: null, openRequests: 0, reservationSoon: false };
const now = Date.parse("2026-11-05T21:00:00Z");

test("libre y reservada", () => {
  assert.equal(tableState({ ...base, hasOrder: false }, 15, now), "FREE");
  assert.equal(tableState({ ...base, hasOrder: false, reservationSoon: true }, 15, now), "RESERVED");
});

test("lo urgente gana: llamado > platos listos > demora > cuenta", () => {
  const late = new Date(now - 20 * 60_000);
  assert.equal(tableState({ ...base, orderStatus: "BILLING", oldestPendingSentAt: late, readyItems: 1, openRequests: 1 }, 15, now), "CALLING");
  assert.equal(tableState({ ...base, orderStatus: "BILLING", oldestPendingSentAt: late, readyItems: 1 }, 15, now), "READY");
  assert.equal(tableState({ ...base, orderStatus: "BILLING", oldestPendingSentAt: late }, 15, now), "LATE");
  assert.equal(tableState({ ...base, orderStatus: "BILLING" }, 15, now), "BILLING");
});

test("una comanda reciente no está demorada", () => {
  assert.equal(tableState({ ...base, oldestPendingSentAt: new Date(now - 5 * 60_000) }, 15, now), "OCCUPIED");
});
