/** Stands in for `server-only` and `next/headers` in pure unit tests. */
export async function cookies() {
  return { getAll: () => [], set: () => {} };
}
export async function headers() {
  return new Map();
}
export {};
