export type IncidentLens = { observation: string; possibleCause: string; nextStep: string };

export function diagnoseIncident(reason: string): IncidentLens {
  const value = reason.toLowerCase();
  if (value.includes("timed out")) return { observation: "The request exceeded the configured monitoring timeout.", possibleCause: "The service or network path may be overloaded.", nextStep: "Review application latency and upstream dependency metrics." };
  if (value.includes("tls") || value.includes("certificate")) return { observation: "The TLS connection could not be verified.", possibleCause: "The certificate may be expired or mismatched.", nextStep: "Inspect certificate validity and hostname coverage." };
  if (value.includes("dns") || value.includes("enotfound")) return { observation: "DNS resolution did not provide a usable destination.", possibleCause: "The DNS record may be missing or propagating.", nextStep: "Check authoritative DNS records and recent changes." };
  if (value.includes("http 5")) return { observation: "The endpoint returned a server-error HTTP response.", possibleCause: "The application or an upstream dependency may be failing.", nextStep: "Review server logs and recent deployments." };
  if (value.includes("http 4")) return { observation: "The endpoint returned a client-error HTTP response.", possibleCause: "The expected route or access policy may have changed.", nextStep: "Verify endpoint routing and expected response configuration." };
  return { observation: "A monitor check failed its configured success criteria.", possibleCause: "The endpoint is unavailable or returned an unexpected response.", nextStep: "Review latest check evidence and service logs." };
}
