import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { z } from "zod";

const internalHostSuffixes = [".localhost", ".local", ".internal", ".home", ".test"];
const exactInternalHosts = new Set(["localhost", "localdomain", "ip6-localhost"]);

function isReservedIpv4(address: string) {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b, c] = octets;

  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)) || (b === 88 && c === 99))) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0 && c === 113);
}

function ipv6Bytes(address: string) {
  const [left, right] = address.toLowerCase().split("::");
  const leftParts = left ? left.split(":") : [];
  const rightParts = right ? right.split(":") : [];
  const parts = [...leftParts, ...Array(Math.max(0, 8 - leftParts.length - rightParts.length)).fill("0"), ...rightParts];
  if (parts.length !== 8 || parts.some((part) => !/^[0-9a-f]{1,4}$/.test(part))) return null;

  return parts.flatMap((part) => {
    const value = Number.parseInt(part, 16);
    return [value >> 8, value & 0xff];
  });
}

function isReservedIpv6(address: string) {
  const bytes = ipv6Bytes(address);
  if (!bytes) return true;
  const isZero = bytes.every((byte) => byte === 0);
  const isLoopback = bytes.slice(0, 15).every((byte) => byte === 0) && bytes[15] === 1;
  const isMappedIpv4 = bytes.slice(0, 10).every((byte) => byte === 0) && bytes[10] === 0xff && bytes[11] === 0xff;
  const mappedIpv4 = bytes.slice(12).join(".");

  return isZero || isLoopback ||
    (bytes[0] & 0xfe) === 0xfc || // unique local: fc00::/7
    (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) || // link-local: fe80::/10
    bytes[0] === 0xff || // multicast
    (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0x0d && bytes[3] === 0xb8) || // documentation: 2001:db8::/32
    (isMappedIpv4 && isReservedIpv4(mappedIpv4));
}

function isReservedAddress(address: string) {
  const version = isIP(address);
  return version === 4 ? isReservedIpv4(address) : version === 6 ? isReservedIpv6(address) : true;
}

async function resolvePublicHost(hostname: string) {
  if (isIP(hostname)) return !isReservedAddress(hostname);
  if (exactInternalHosts.has(hostname) || internalHostSuffixes.some((suffix) => hostname.endsWith(suffix)) || !hostname.includes(".")) {
    return false;
  }

  try {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    return addresses.length > 0 && addresses.every(({ address }) => !isReservedAddress(address));
  } catch {
    return false;
  }
}

export const monitorInputSchema = z.object({
  name: z.string().trim().min(1, "Enter a monitor name.").max(100, "Name must be 100 characters or fewer."),
  url: z.string().trim().min(1, "Enter a URL.").max(2048, "URL must be 2,048 characters or fewer."),
  expectedHttpStatus: z.coerce.number().int().min(100, "Use an HTTP status from 100 to 599.").max(599, "Use an HTTP status from 100 to 599."),
  checkIntervalSeconds: z.coerce.number().int().refine((value) => [30, 60, 120].includes(value), "Choose 30, 60, or 120 seconds."),
  isActive: z.boolean(),
}).superRefine(async (value, context) => {
  let parsed: URL;
  try {
    parsed = new URL(value.url);
  } catch {
    context.addIssue({ code: "custom", path: ["url"], message: "Enter a valid HTTP or HTTPS URL." });
    return;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    context.addIssue({ code: "custom", path: ["url"], message: "Only HTTP and HTTPS URLs are allowed." });
    return;
  }

  if (parsed.username || parsed.password) {
    context.addIssue({ code: "custom", path: ["url"], message: "URLs with embedded credentials are not allowed." });
    return;
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!(await resolvePublicHost(hostname))) {
    context.addIssue({ code: "custom", path: ["url"], message: "This URL resolves to a local, private, reserved, or unavailable host." });
  }
});

export function normalizeMonitorUrl(url: string) {
  return new URL(url).toString();
}
