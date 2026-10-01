export const CONNECTION_RETRY_DELAYS_MS = [0, 1000, 2000, 4000, 8000] as const;

export async function retryConnection<T>(
  operation: () => Promise<T>,
  onRetry: (attempt: number, delayMilliseconds: number, error: unknown) => void,
  delays: readonly number[] = CONNECTION_RETRY_DELAYS_MS,
): Promise<T> {
  let lastError: unknown;
  for (let index = 0; index < delays.length; index += 1) {
    const delay = delays[index] ?? 0;
    if (delay > 0) {
      onRetry(index + 1, delay, lastError);
      await new Promise(resolve => globalThis.setTimeout(resolve, delay));
    }
    try {
      return await operation();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}
