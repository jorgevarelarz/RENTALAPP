import Redis from 'ioredis';

let redisClient: Redis | null = null;
let redisUnavailable = false;

function resolveRedisUrl() {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;
  if (process.env.REDIS_HOST) {
    const port = Number(process.env.REDIS_PORT || 6379);
    return `redis://${process.env.REDIS_HOST}:${port}`;
  }
  return null;
}

export function getRedisClient() {
  if (redisUnavailable) return null;
  if (process.env.NODE_ENV === 'test') return null;
  if (redisClient) return redisClient;

  const url = resolveRedisUrl();
  if (!url) return null;

  try {
    redisClient = new Redis(url, { maxRetriesPerRequest: 1 });
    redisClient.on('error', err => {
      console.warn('[redis] connection error:', err?.message || err);
      redisUnavailable = true;
      try {
        redisClient?.disconnect();
      } catch {}
      redisClient = null;
    });
    return redisClient;
  } catch (err) {
    console.warn('[redis] init failed:', (err as any)?.message || err);
    redisUnavailable = true;
    redisClient = null;
    return null;
  }
}
