// ioredis-mock is a drop-in in-memory replacement for ioredis.
// It supports the same API (get, set, incr, expire, ttl, del)
// without needing a real Redis server running.
//
// We mock the entire redis config module so that anything importing
// redisClient gets the mock version — fully transparent to the code under test.

jest.mock("../../config/redis", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const RedisMock = require("ioredis-mock");
  const redisMock = new RedisMock();

  return {
    default: redisMock,
    redisClient: {
      async incrementWithExpiry(key: string, windowSeconds: number): Promise<number> {
        const count = await redisMock.incr(key);
        if (count === 1) {
          await redisMock.expire(key, windowSeconds);
        }
        return count;
      },
      async get(key: string): Promise<string | null> {
        return redisMock.get(key);
      },
      async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
        if (ttlSeconds) {
          await redisMock.setex(key, ttlSeconds, value);
        } else {
          await redisMock.set(key, value);
        }
      },
      async del(key: string): Promise<void> {
        await redisMock.del(key);
      },
      async ttl(key: string): Promise<number> {
        return redisMock.ttl(key);
      },
      // Expose flushall for resetting between tests
      async flush(): Promise<void> {
        await redisMock.flushall();
      },
    },
  };
});

// Export a flush helper so test files can reset Redis state between tests
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { redisClient } = require("../../config/redis");
export const flushRedis = () => redisClient.flush?.();