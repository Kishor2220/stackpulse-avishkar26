import assert from "node:assert/strict";
import test from "node:test";
import { MonitorScheduler, type ActiveMonitor } from "./scheduler.js";

const monitor: ActiveMonitor = { id: "monitor-1", name: "Status", url: "https://status.example", expected_http_status: 200, check_interval_seconds: 30 };

test("schedules configured intervals and does not overlap the same monitor", async () => {
  const calls: string[] = [];
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  const scheduler = new MonitorScheduler({
    loadActiveMonitors: async () => [monitor],
    checkMonitor: async (item) => { calls.push(item.id); await pending; },
    refreshMs: 10_000,
  });

  const firstTick = scheduler.tick(0);
  await scheduler.tick(1_000);
  assert.deepEqual(calls, ["monitor-1"]);
  release();
  await firstTick;
  await scheduler.tick(29_999);
  assert.deepEqual(calls, ["monitor-1"]);
  await scheduler.tick(30_000);
  assert.deepEqual(calls, ["monitor-1", "monitor-1"]);
});
