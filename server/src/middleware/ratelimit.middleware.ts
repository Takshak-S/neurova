import { Request,Response,NextFunction } from "express";
import { redisClient } from "../config/redis";
import {env} from "../config/env";
import {ApiError} from "../utils/ApiError";

// Redis-based rate limiter specifically for OTP send requests.
// Why Redis instead of express-rate-limit (memory)?
// Memory-based rate limiting resets when the server restarts and
// doesn't work across multiple server instances.
// Redis persists across restarts and is shared between all instances.
//
// Key format: "otp_rl:{phone}" → e.g. "otp_rl:+919876543210"
// Value: request count (auto-incremented)
// TTL: OTP_RATE_LIMIT_WINDOW_MINUTES (default: 10 minutes)

export const otpRateLimitMiddleware = async (
    req:Request,
    res:Response,
    next:NextFunction
):Promise<void> =>{
    const {phone}=req.body;

  // Phone validation happens in the validate middleware (runs before this),
  // so phone is guaranteed to be a valid string here

  if(!phone) {
    next(ApiError.badRequest("Phone number is required"));
    return;
  }

  const key=`otp_rl:${phone}`;
  const windowSeconds = env.otp.rateLimitWindowMinutes*60;

  const count=await redisClient.incrementWithExpiry(key,windowSeconds);

  // Attach rate limit info to response headers — this is the standard pattern
  // used by GitHub, Twitter, etc. Helps clients know when to back off.

  const remaining = Math.max(0,env.otp.rateLimitMaxRequests-count);
  const ttl=await redisClient.ttl(key);

  res.setHeader("x-RateLimit-Limit",env.otp.rateLimitMaxRequests);
  res.setHeader("x-RateLimit-Remaining",remaining);
  res.setHeader("x-RateLimit-Reset",Date.now()+ttl*1000);

  if (count>env.otp.rateLimitMaxRequests){
    next(ApiError.tooManyRequests(
        `Too many requests. Please try again in ${Math.ceil(ttl/60)} minutes.`
    )
    );
    return;
  }

  next();
}