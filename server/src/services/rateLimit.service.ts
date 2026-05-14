import redis from "../config/redis";

// Allow at most 5 OTP requests per phone per 15-minute window
const MAX_OTP_REQUESTS = 5;
const WINDOW_SECONDS = 15 * 60; // 15 minutes

/**
 * Check whether the phone has exceeded the OTP send rate limit.
 * Returns { allowed, remaining, retryAfter }.
 */
export const checkOTPRateLimit = async (
    phone: string
): Promise<{ allowed: boolean; remaining: number; retryAfter: number }> => {
    const key = `otp_rate:${phone}`;

    const current = await redis.incr(key);

    // Set expiry only on the first request in this window
    if (current === 1) {
        await redis.expire(key, WINDOW_SECONDS);
    }

    const ttl = await redis.ttl(key);

    if (current > MAX_OTP_REQUESTS) {
        return {
            allowed: false,
            remaining: 0,
            retryAfter: ttl > 0 ? ttl : WINDOW_SECONDS,
        };
    }

    return {
        allowed: true,
        remaining: MAX_OTP_REQUESTS - current,
        retryAfter: 0,
    };
};
