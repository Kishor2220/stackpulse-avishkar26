import assert from "node:assert/strict";
import test from "node:test";
import { ResendEmailProvider } from "./email-provider.js";

const message = { to: "developer@example.test", subject: "Test", text: "Test", html: "<p>Test</p>" };
test("records provider acceptance only when Resend returns a message id", async () => {
  const provider = new ResendEmailProvider("key", "StackPulse <alerts@example.test>", async () => new Response(JSON.stringify({ id: "email-id" }), { status: 200 }));
  assert.deepEqual(await provider.send(message), { accepted: true, providerMessageId: "email-id" });
});
test("classifies missing configuration and provider rate limiting safely", async () => {
  assert.deepEqual(await new ResendEmailProvider(undefined, undefined).send(message), { accepted: false, category: "configuration" });
  const provider = new ResendEmailProvider("key", "alerts@example.test", async () => new Response("", { status: 429 }));
  assert.deepEqual(await provider.send(message), { accepted: false, category: "rate-limit" });
});
