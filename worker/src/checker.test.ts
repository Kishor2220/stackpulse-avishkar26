import assert from "node:assert/strict";
import test from "node:test";
import { createPinnedLookup, responseLimitExceeded, statusMatches } from "./checker.js";

test("compares actual response status to the configured expectation", () => {
  assert.equal(statusMatches(200, 200), true);
  assert.equal(statusMatches(503, 200), false);
});

test("detects response bodies beyond the configured safety limit", () => {
  assert.equal(responseLimitExceeded(1_024, 1_024), false);
  assert.equal(responseLimitExceeded(1_025, 1_024), true);
});

test("returns an address list when Node requests all lookup results", async () => {
  const lookup = createPinnedLookup({ address: "1.1.1.1", family: 4 });
  await new Promise<void>((resolve, reject) => {
    lookup("example.com", { all: true }, (error, address) => {
      if (error) return reject(error);
      assert.deepEqual(address, [{ address: "1.1.1.1", family: 4 }]);
      resolve();
    });
  });
});

test("returns the pinned scalar address for a single-address lookup", async () => {
  const lookup = createPinnedLookup({ address: "1.1.1.1", family: 4 });
  await new Promise<void>((resolve, reject) => {
    lookup("example.com", { all: false }, (error, address, family) => {
      if (error) return reject(error);
      assert.equal(address, "1.1.1.1");
      assert.equal(family, 4);
      resolve();
    });
  });
});
