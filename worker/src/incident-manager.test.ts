import assert from "node:assert/strict";
import test from "node:test";
import { IncidentManager, type IncidentNotifier, type IncidentRecord, type IncidentRepository } from "./incident-manager.js";
import type { CheckResult } from "./checker.js";

const failed: CheckResult = { httpStatus: 503, responseLatencyMs: 12, isSuccess: false, tlsExpiresAt: null, errorDetails: "Expected HTTP 200, received HTTP 503." };
const succeeded: CheckResult = { httpStatus: 200, responseLatencyMs: 10, isSuccess: true, tlsExpiresAt: null, errorDetails: null };

class FakeRepository implements IncidentRepository {
  openCount = 0;
  resolveCount = 0;
  openIncident: IncidentRecord | null = null;

  async open(_monitorId: string, _reason: string) {
    this.openCount += 1;
    if (this.openIncident) return null;
    this.openIncident = { id: "incident-1", openedAt: "2026-01-01T00:00:00.000Z" };
    return this.openIncident;
  }

  async resolve(_monitorId: string) {
    this.resolveCount += 1;
    if (!this.openIncident) return null;
    const resolved = { ...this.openIncident, resolvedAt: "2026-01-01T00:01:00.000Z" };
    this.openIncident = null;
    return resolved;
  }
}

class FakeNotifier implements IncidentNotifier {
  events: string[] = [];
  notify(event: "opened" | "resolved") { this.events.push(event); }
}

function manager(repository = new FakeRepository(), notifier = new FakeNotifier()) {
  return { repository, notifier, manager: new IncidentManager(repository, notifier) };
}

test("one or two consecutive failures do not open an incident", async () => {
  const setup = manager();
  await setup.manager.observe("monitor-1", failed);
  await setup.manager.observe("monitor-1", failed);
  assert.equal(setup.repository.openCount, 0);
  assert.deepEqual(setup.notifier.events, []);
});

test("three consecutive failures open one incident", async () => {
  const setup = manager();
  await setup.manager.observe("monitor-1", failed);
  await setup.manager.observe("monitor-1", failed);
  await setup.manager.observe("monitor-1", failed);
  assert.equal(setup.repository.openCount, 1);
  assert.deepEqual(setup.notifier.events, ["opened"]);
});

test("further failures do not create duplicate open incidents", async () => {
  const setup = manager();
  for (let count = 0; count < 5; count += 1) await setup.manager.observe("monitor-1", failed);
  assert.equal(setup.repository.openCount, 1);
  assert.deepEqual(setup.notifier.events, ["opened"]);
});

test("a successful check resolves an open incident", async () => {
  const setup = manager();
  for (let count = 0; count < 3; count += 1) await setup.manager.observe("monitor-1", failed);
  await setup.manager.observe("monitor-1", succeeded);
  assert.equal(setup.repository.resolveCount, 1);
  assert.deepEqual(setup.notifier.events, ["opened", "resolved"]);
});

test("a restart does not backfill old failures and remains idempotent with an existing incident", async () => {
  const repository = new FakeRepository();
  const notifier = new FakeNotifier();
  const beforeRestart = new IncidentManager(repository, notifier);
  await beforeRestart.observe("monitor-1", failed);
  await beforeRestart.observe("monitor-1", failed);

  const afterRestart = new IncidentManager(repository, notifier);
  await afterRestart.observe("monitor-1", failed);
  assert.equal(repository.openCount, 0);

  await afterRestart.observe("monitor-1", failed);
  await afterRestart.observe("monitor-1", failed);
  assert.equal(repository.openCount, 1);
  await afterRestart.observe("monitor-1", failed);
  assert.equal(repository.openCount, 1);
  assert.deepEqual(notifier.events, ["opened"]);
});
