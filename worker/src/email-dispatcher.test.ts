import assert from "node:assert/strict";
import test from "node:test";
import { EmailDispatcher, type EmailDelivery, type EmailDeliveryRepository } from "./email-dispatcher.js";

const job: EmailDelivery = { id: "delivery", notificationId: "notice", ownerId: "owner", attemptCount: 0, recipient: "developer@example.test", subject: "Alert", text: "Alert", html: "<p>Alert</p>" };
function repo(): EmailDeliveryRepository & { calls: string[]; available: boolean } { const value = { calls: [] as string[], available: true, async claim() { if (!value.available) return null; value.available = false; return job; }, async accepted() { value.calls.push("accepted"); }, async retry() { value.calls.push("retry"); }, async failed() { value.calls.push("failed"); } }; return value; }
test("records provider acceptance once for a claimed job", async () => { const store = repo(); await new EmailDispatcher(store, { send: async () => ({ accepted: true, providerMessageId: "msg" }) }, "worker").processOne(new Date(0)); assert.deepEqual(store.calls, ["accepted"]); });
test("retries transient and rate-limited provider failures", async () => { const store = repo(); await new EmailDispatcher(store, { send: async () => ({ accepted: false, category: "rate-limit" }) }, "worker").processOne(new Date(0)); assert.deepEqual(store.calls, ["retry"]); });
test("does not retry permanent configuration failures", async () => { const store = repo(); await new EmailDispatcher(store, { send: async () => ({ accepted: false, category: "configuration" }) }, "worker").processOne(new Date(0)); assert.deepEqual(store.calls, ["failed"]); });
