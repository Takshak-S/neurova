import { Router, Request, Response, NextFunction } from "express";
import { aiController } from "../controllers/ai.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";
import { validate } from "../middleware/validate.middleware";
import { aiProcessSchema } from "../ai/ai.validation";
import { redisClient } from "../config/redis";
import { ApiError } from "../utils/ApiError";
import { env } from "../config/env";

const router = Router();

// All AI routes require authentication
router.use(asyncHandler(authMiddleware));

// ── Per-user AI rate limiter ──────────────────────────────────────────────────
// AI requests are expensive (even on free tier, quota is finite).
// We rate limit per user — not per IP — because users are authenticated.
// Limit: 20 AI requests per hour per user.
// This prevents a single user from exhausting the Groq free tier quota.
const AI_RATE_LIMIT = 20;
const AI_RATE_WINDOW_SECONDS = 3600; // 1 hour

const aiRateLimitMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userId = req.user!._id.toString();
  const key = `ai_rl:${userId}`;

  const count = await redisClient.incrementWithExpiry(key, AI_RATE_WINDOW_SECONDS);
  const remaining = Math.max(0, AI_RATE_LIMIT - count);
  const ttl = await redisClient.ttl(key);

  // Standard rate limit headers — same pattern as OTP rate limiting
  res.setHeader("X-AI-RateLimit-Limit", AI_RATE_LIMIT);
  res.setHeader("X-AI-RateLimit-Remaining", remaining);
  res.setHeader("X-AI-RateLimit-Reset", Date.now() + ttl * 1000);

  if (count > AI_RATE_LIMIT) {
    next(
      ApiError.tooManyRequests(
        `AI rate limit exceeded. You can make ${AI_RATE_LIMIT} AI requests per hour. ` +
        `Resets in ${Math.ceil(ttl / 60)} minutes.`
      )
    );
    return;
  }

  next();
};

// POST /ai/process
// Pipeline: auth → rate limit → validate body → controller
router.post(
  "/process",
  asyncHandler(aiRateLimitMiddleware),
  validate(aiProcessSchema),
  asyncHandler(aiController.process)
);

// GET /ai/health
// No rate limit — health checks are cheap and monitoring tools call this often
router.get("/health", asyncHandler(aiController.health));

export default router;