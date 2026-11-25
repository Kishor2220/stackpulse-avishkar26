import assert from "node:assert/strict";
import test from "node:test";
import { isBlockedIp, resolvePublicDestination, UnsafeDestinationError } from "./security.js";

test("blocks private, loopback, link-local, and documentation IP addresses", () => {
  for (const address of ["127.0.0.1", "10.0.0.1", "169.254.1.1", "192.168.0.1", "::1", "fc00::1", "2001:db8::1"]) {
    assert.equal(isBlockedIp(address), true, address);
  }
  assert.equal(isBlockedIp("1.1.1.1"), false);
});

test("rejects internal hostnames and mixed public/private DNS results", async () => {
  await assert.rejects(resolvePublicDestination("http://localhost"), UnsafeDestinationError);
  await assert.rejects(resolvePublicDestination("https://public.example", async () => [{ address: "1.1.1.1", family: 4 }, { address: "10.0.0.1", family: 4 }]), UnsafeDestinationError);
});

test("returns a validated address to pin a public endpoint connection", async () => {
  const destination = await resolvePublicDestination("https://status.example/path", async () => [{ address: "1.1.1.1", family: 4 }]);
  assert.equal(destination.address, "1.1.1.1");
  assert.equal(destination.hostname, "status.example");
});
