import assert from "node:assert/strict";
import test from "node:test";
import { withRetry } from "./retry.js";

test("retries a transient operation with bounded exponential delays", async () => {
  let calls = 0;
  const delays: number[] = [];
  const result = await withRetry(async () => {
    calls += 1;
    if (calls < 3) throw new Error("temporary database outage");
    return "saved";
  }, { attempts: 3, baseDelayMs: 10, sleep: async (delay) => { delays.push(delay); } });

  assert.equal(result, "saved");
  assert.equal(calls, 3);
  assert.deepEqual(delays, [10, 20]);
});

test("does not retry beyond the configured attempt limit", async () => {
  let calls = 0;
  await assert.rejects(() => withRetry(async () => {
    calls += 1;
    throw new Error("database unavailable");
  }, { attempts: 2, baseDelayMs: 1, sleep: async () => undefined }));
  assert.equal(calls, 2);
});
