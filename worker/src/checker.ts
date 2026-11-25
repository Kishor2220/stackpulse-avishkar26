import * as http from "node:http";
import * as https from "node:https";
import { performance } from "node:perf_hooks";
import type { LookupFunction } from "node:net";
import { TLSSocket } from "node:tls";
import { redactUrl, resolvePublicDestination, UnsafeDestinationError } from "./security.js";

export type CheckResult = {
  httpStatus: number | null;
  responseLatencyMs: number | null;
  isSuccess: boolean;
  tlsExpiresAt: string | null;
  errorDetails: string | null;
};

export type CheckOptions = { timeoutMs: number; maxResponseBytes: number };

export function statusMatches(actual: number, expected: number) {
  return actual === expected;
}

export function responseLimitExceeded(currentBytes: number, maximumBytes: number) {
  return currentBytes > maximumBytes;
}

export function createPinnedLookup(destination: { address: string; family: 4 | 6 }): LookupFunction {
  return (_hostname, options, callback) => {
    // Node may request `all: true` when auto-selecting address families. Return
    // the shape it requested, even though the worker intentionally exposes only
    // the already validated, pinned address.
    if (options.all) {
      callback(null, [{ address: destination.address, family: destination.family }]);
      return;
    }
    callback(null, destination.address, destination.family);
  };
}

function safeError(error: unknown) {
  if (error instanceof UnsafeDestinationError) return error.message;
  if (error instanceof Error && error.message === "Request timed out.") return error.message;
  if (error instanceof Error && error.message === "Response body exceeded configured limit.") return error.message;
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") return `Connection failed (${error.code}).`;
  return "Connection failed.";
}

function certificateExpiry(socket: unknown) {
  if (!(socket instanceof TLSSocket)) return null;
  const validTo = socket.getPeerCertificate()?.valid_to;
  if (!validTo) return null;
  const parsed = new Date(validTo);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export async function checkEndpoint(rawUrl: string, expectedStatus: number, options: CheckOptions): Promise<CheckResult> {
  const startedAt = performance.now();

  try {
    const destination = await resolvePublicDestination(rawUrl);
    const transport = destination.url.protocol === "https:" ? https : http;

    return await new Promise<CheckResult>((resolve) => {
      let settled = false;
      const finish = (result: CheckResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(totalTimeout);
        resolve(result);
      };
      const fail = (error: unknown) => finish({
        httpStatus: null,
        responseLatencyMs: Math.round(performance.now() - startedAt),
        isSuccess: false,
        tlsExpiresAt: null,
        errorDetails: safeError(error),
      });
      const totalTimeout = setTimeout(() => request.destroy(new Error("Request timed out.")), options.timeoutMs);
      const request = transport.request({
        protocol: destination.url.protocol,
        hostname: destination.hostname,
        port: destination.url.port || undefined,
        path: `${destination.url.pathname}${destination.url.search}`,
        method: "GET",
        agent: false,
        family: destination.family,
        servername: destination.url.protocol === "https:" ? destination.hostname : undefined,
        rejectUnauthorized: true,
        headers: {
          Host: destination.url.host,
          "User-Agent": "StackPulse-Worker/0.1",
          Accept: "*/*",
        },
        lookup: createPinnedLookup(destination),
      }, (response) => {
        const status = response.statusCode ?? 0;
        const latency = Math.round(performance.now() - startedAt);
        const tlsExpiresAt = certificateExpiry(response.socket);
        let responseBytes = 0;

        response.on("data", (chunk: Buffer) => {
          responseBytes += chunk.length;
          if (responseLimitExceeded(responseBytes, options.maxResponseBytes)) {
            request.destroy(new Error("Response body exceeded configured limit."));
          }
        });
        response.on("error", fail);
        response.on("end", () => finish({
          httpStatus: status,
          responseLatencyMs: latency,
          isSuccess: statusMatches(status, expectedStatus),
          tlsExpiresAt,
          errorDetails: statusMatches(status, expectedStatus) ? null : `Expected HTTP ${expectedStatus}, received HTTP ${status}.`,
        }));
      });

      request.on("error", fail);
      request.setTimeout(options.timeoutMs, () => request.destroy(new Error("Request timed out.")));
      request.end();
    });
  } catch (error) {
    return {
      httpStatus: null,
      responseLatencyMs: Math.round(performance.now() - startedAt),
      isSuccess: false,
      tlsExpiresAt: null,
      errorDetails: safeError(error),
    };
  }
}

export function checkLogLine(monitorId: string, url: string, result: CheckResult) {
  const target = redactUrl(url);
  if (result.isSuccess) return `[check] ${monitorId} ${target} OK ${result.httpStatus} ${result.responseLatencyMs}ms`;
  return `[check] ${monitorId} ${target} FAILED ${result.errorDetails ?? "Unknown error"}`;
}
