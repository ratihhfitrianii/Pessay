import { Redis } from "ioredis";

/**
 * Cache Redis opsional dengan graceful degradation.
 * Jika Redis mati/tidak dikonfigurasi, semua operasi jadi no-op — app tetap berjalan.
 */
let redis: Redis | null = null;
let disabled = false;

function connect(): void {
  if (disabled || !process.env.REDIS_URL) return;
  try {
    const client = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableOfflineQueue: true,
      lazyConnect: true,
      retryStrategy: (times: number) =>
        times > 5 ? null : Math.min(times * 200, 2000),
    });
    redis = client;
    redis.on("error", () => {
      redis = null;
    });
    void redis.connect().catch(() => {
      redis = null;
    });
  } catch {
    redis = null;
  }
}

connect();

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    /* no-op */
  }
}

export async function cacheDel(key: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(key);
  } catch {
    /* no-op */
  }
}

export async function cacheDelPattern(pattern: string): Promise<void> {
  if (!redis) return;
  try {
    const keys = await redis.keys(pattern);
    if (keys.length) await redis.del(...keys);
  } catch {
    /* no-op */
  }
}
