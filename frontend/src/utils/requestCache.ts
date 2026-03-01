type CacheEntry<T> = {
  expiresAt: number;
  data: T;
};

const memoryCache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export async function cachedRequest<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = 30_000,
): Promise<T> {
  const now = Date.now();
  const cached = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) {
    return pending;
  }

  const req = fetcher()
    .then((data) => {
      memoryCache.set(key, { data, expiresAt: Date.now() + ttlMs });
      return data;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, req);
  return req;
}

export function clearRequestCache(prefix?: string) {
  if (!prefix) {
    memoryCache.clear();
    return;
  }
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) {
      memoryCache.delete(key);
    }
  }
}
