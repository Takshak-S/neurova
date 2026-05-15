import Redis from "ioredis";
import {env} from "./env"

// ioredis automatically handles reconnection — we just configure the strategy.
// retryStrategy: called every time a reconnect attempt fails.
// Returns the delay in ms before the next attempt, or null to stop retrying.

const redis = new Redis(env.redisUrl, {
    retryStrategy(times) {
        if (times>10) {
            console.error("❌ Redis: Too many reconnection attempts. Giving up.");
            return null;
        }

        const delay = Math.min(times*200,3000); //exponential backoff, max 3s
        console.warn(`⏳ Redis reconnecting in ${delay}ms (attempt ${times})`);
        return delay;
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
})

redis.on("connect", () => console.log("✅ Redis connected"));
redis.on("error", (err) => console.error("Redis error:", err.message));
redis.on("close", ()=> console.warn("⚠️  Redis connection closed"));

// Helper functions — these are the only Redis operations Neurova needs.
// Wrapping them here means the rest of the codebase never imports ioredis directly.
// If we ever switch Redis clients, we change it in one place.

export const redisClient = {
    //Rate limiting: increment a counter, set TTL if it's a new key
    async incrementWithExpiry(key:string, windowSeconds: number): Promise<number>{
        const count = await redis.incr(key);

        if(count==1) {
            //only set expiry on the first increment - preserves the original window
            await redis.expire(key,windowSeconds);
        }
        return count;
    },

    async get(key:string):Promise<string | null> {
        return redis.get(key);
    },

    async set(key:string, value:string, ttlSeconds?:number):Promise<void> {
        if (ttlSeconds) {
            await redis.setex(key, ttlSeconds, value);
        } else {
            await redis.set(key, value);
        }
    },

    async del(key:string):Promise<void> {
        await redis.del(key);
    },

    async ttl(key:string):Promise<number> {
        return redis.ttl(key);
    },
};

export default redis;
