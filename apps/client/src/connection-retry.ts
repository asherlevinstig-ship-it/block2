export const CONNECTION_RETRY_DELAYS_MS = [0, 1000, 2000, 4000, 8000] as const;

export async function retryConnection<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  onRetry: (attempt: number, delayMilliseconds: number, error: unknown) => void,
  delays: readonly number[] = CONNECTION_RETRY_DELAYS_MS,
  attemptTimeoutMilliseconds = 10000,
): Promise<T> {
  let lastError: unknown;
  for (let index = 0; index < delays.length; index += 1) {
    const delay = delays[index] ?? 0;
    if (delay > 0) {
      onRetry(index + 1, delay, lastError);
      await new Promise(resolve => globalThis.setTimeout(resolve, delay));
    }
    try {
      let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined;
      const controller = new AbortController();
      try {
        return await Promise.race([
          operation(controller.signal),
          new Promise<never>((_resolve, reject) => {
            timeoutId = globalThis.setTimeout(
              () => {
                controller.abort();
                reject(new Error("Matchmaking timed out"));
              },
              attemptTimeoutMilliseconds,
            );
          }),
        ]);
      } finally {
        if (timeoutId !== undefined) globalThis.clearTimeout(timeoutId);
      }
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}
