import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
        if (times > 3) {
            console.error("Redis: max retries reached, giving up");
            return null; // stop retrying
        }
        return Math.min(times * 200, 2000);
    },
});

redis.on("connect", () => console.log("Redis connected"));
redis.on("error", (err) => console.error("Redis error:", err.message));

export default redis;
