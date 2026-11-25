import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type ResolvedAddress = { address: string; family: 4 | 6 };
export type LookupResolver = (hostname: string) => Promise<ResolvedAddress[]>;

const internalSuffixes = [".localhost", ".local", ".internal", ".home", ".test"];
const internalHosts = new Set(["localhost", "localdomain", "ip6-localhost"]);

export class UnsafeDestinationError extends Error {}

function isBlockedIpv4(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b, c] = parts;

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

function isBlockedIpv6(address: string) {
  const bytes = ipv6Bytes(address);
  if (!bytes) return true;
  const isZero = bytes.every((byte) => byte === 0);
  const isLoopback = bytes.slice(0, 15).every((byte) => byte === 0) && bytes[15] === 1;
  const isMappedIpv4 = bytes.slice(0, 10).every((byte) => byte === 0) && bytes[10] === 0xff && bytes[11] === 0xff;
  const mappedIpv4 = bytes.slice(12).join(".");

  return isZero || isLoopback ||
    (bytes[0] & 0xfe) === 0xfc ||
    (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) ||
    bytes[0] === 0xff ||
    (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0x0d && bytes[3] === 0xb8) ||
    (isMappedIpv4 && isBlockedIpv4(mappedIpv4));
}

export function isBlockedIp(address: string) {
  const version = isIP(address);
  return version === 4 ? isBlockedIpv4(address) : version === 6 ? isBlockedIpv6(address) : true;
}

const defaultLookup: LookupResolver = async (hostname) => {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map(({ address, family }) => ({ address, family: family as 4 | 6 }));
};

function normalizedHostname(hostname: string) {
  return hostname.toLowerCase().replace(/^\[|\]$/g, "");
}

export function redactUrl(value: string) {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`;
  } catch {
    return "invalid-url";
  }
}

export async function resolvePublicDestination(value: string, resolver: LookupResolver = defaultLookup) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new UnsafeDestinationError("Invalid endpoint URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") throw new UnsafeDestinationError("Only HTTP and HTTPS endpoints are supported.");
  if (url.username || url.password) throw new UnsafeDestinationError("Endpoint URLs must not include credentials.");

  const hostname = normalizedHostname(url.hostname);
  if (internalHosts.has(hostname) || internalSuffixes.some((suffix) => hostname.endsWith(suffix)) || !hostname.includes(".")) {
    throw new UnsafeDestinationError("Internal destinations are blocked.");
  }

  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) as 4 | 6 }]
    : await resolver(hostname);

  if (addresses.length === 0 || addresses.some(({ address }) => isBlockedIp(address))) {
    throw new UnsafeDestinationError("Private or reserved destinations are blocked.");
  }

  return { url, hostname, address: addresses[0].address, family: addresses[0].family };
}
