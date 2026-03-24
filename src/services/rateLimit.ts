type ProviderId = "finnhub" | "polygon" | "reddit";

interface ProviderLimiterState {
  nextAllowedAt: number;
  queue: Promise<void>;
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const limitState = new Map<ProviderId, ProviderLimiterState>();

/**
 * Serializes provider requests and enforces a maximum requests-per-minute budget.
 * This is process-local and shared by all callers in the current Node process.
 */
export const throttleProvider = async (provider: ProviderId, requestsPerMinute: number): Promise<void> => {
  const intervalMs = Math.ceil(60_000 / Math.max(1, requestsPerMinute));
  const current = limitState.get(provider) ?? { nextAllowedAt: 0, queue: Promise.resolve() };

  const nextQueue = current.queue.then(async () => {
    const now = Date.now();
    const waitMs = Math.max(0, current.nextAllowedAt - now);
    if (waitMs > 0) {
      await sleep(waitMs);
    }
    current.nextAllowedAt = Date.now() + intervalMs;
  });

  current.queue = nextQueue.catch(() => undefined);
  limitState.set(provider, current);

  await nextQueue;
};
