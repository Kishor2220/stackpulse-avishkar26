import assert from "node:assert/strict";
import test from "node:test";
import { classifyHeartbeat } from "./health.js";

const observedAt = "2026-11-25T12:03:00.000Z";

test("classifies a recent heartbeat as healthy", () => {
  assert.equal(classifyHeartbeat("2026-11-25T12:01:00.000Z", observedAt, 180), "healthy");
});

test("classifies an expired heartbeat as stale and absent telemetry as unknown", () => {
  assert.equal(classifyHeartbeat("2026-11-25T11:59:59.000Z", observedAt, 180), "stale");
  assert.equal(classifyHeartbeat(null, observedAt, 180), "unknown");
});
