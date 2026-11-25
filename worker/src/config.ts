import "dotenv/config";

export type WorkerConfig = {
  supabaseUrl: string;
  serviceRoleKey: string;
  workerId: string;
  timeoutMs: number;
  maxResponseBytes: number;
};

function positiveInteger(value: string | undefined, fallback: number, variable: string) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${variable} must be a positive integer.`);
  return parsed;
}

export function loadConfig(): WorkerConfig {
  const missing = ["WORKER_SUPABASE_URL", "WORKER_SUPABASE_SERVICE_ROLE_KEY", "WORKER_ID"].filter((name) => !process.env[name]);
  if (missing.length) throw new Error(`Missing required worker configuration: ${missing.join(", ")}.`);

  return {
    supabaseUrl: process.env.WORKER_SUPABASE_URL as string,
    serviceRoleKey: process.env.WORKER_SUPABASE_SERVICE_ROLE_KEY as string,
    workerId: process.env.WORKER_ID as string,
    timeoutMs: positiveInteger(process.env.WORKER_TIMEOUT_MS, 10_000, "WORKER_TIMEOUT_MS"),
    maxResponseBytes: positiveInteger(process.env.WORKER_MAX_RESPONSE_BYTES, 1_048_576, "WORKER_MAX_RESPONSE_BYTES"),
  };
}
