import { Router } from "express";
import {authController} from "../controllers/auth.controller";
import {validate, sendOTPSchema, verifyOTPSchema} from "../middleware/validate.middleware";
import {otpRateLimitMiddleware} from "../middleware/rateLimit.middleware";
import {authMiddleware} from "../middleware/auth.middleware";
import {asyncHandler} from "../utils/asyncHandler";

const router = Router();

// POST /auth/send-otp
// Middleware chain: validate body → rate limit → controller
// Rate limit runs AFTER validation so we don't increment the counter
// for obviously invalid requests (wrong format, missing fields)
router.post("/send-otp", validate(sendOTPSchema),asyncHandler(otpRateLimitMiddleware),asyncHandler(authController.sendOTP));

// POST /auth/verify-otp
// No rate limit middleware here — attempts are tracked in the OTP document itself
router.post("/verify-otp", validate(verifyOTPSchema),asyncHandler(authController.verifyOTP));

// POST /auth/refresh
// Requires a valid token — issues a new one
router.post("/refresh",asyncHandler(authMiddleware),asyncHandler(authController.refreshToken));

// GET /auth/me
// Protected — requires a valid JWT
router.get("/me",asyncHandler(authMiddleware),asyncHandler(authController.getMe))

export default router;