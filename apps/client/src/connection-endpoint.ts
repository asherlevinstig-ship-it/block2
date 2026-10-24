export function connectionEndpointForAttempt(
  primary: string,
  fallback: string | null,
  attempt: number,
  fallbackEnabled: boolean,
): string {
  if (!fallbackEnabled || !fallback || attempt < 2) return primary;
  return attempt % 2 === 0 ? fallback : primary;
}
