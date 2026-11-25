export type RetryOptions = {
  attempts: number;
  baseDelayMs: number;
  maxDelayMs?: number;
  sleep?: (delayMs: number) => Promise<void>;
};

const defaultSleep = (delayMs: number) => new Promise<void>((resolve) => setTimeout(resolve, delayMs));

/** Retries a transient operation with bounded exponential backoff. */
export async function withRetry<T>(operation: () => Promise<T>, options: RetryOptions): Promise<T> {
  const attempts = Math.max(1, options.attempts);
  const sleep = options.sleep ?? defaultSleep;
  const maxDelayMs = options.maxDelayMs ?? 2_000;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      const delay = Math.min(maxDelayMs, options.baseDelayMs * 2 ** (attempt - 1));
      await sleep(delay);
    }
  }
  throw lastError;
}
