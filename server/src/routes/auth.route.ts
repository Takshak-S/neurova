import { Router } from "express";
import { sendOTP, verifyOTP } from "../controllers/auth.controller";
import { validatePhone, validateOTP } from "../validations/auth.validation";

const router = Router();

// POST /auth/send-otp   — request an OTP via SMS
router.post("/send-otp", validatePhone, sendOTP);

// POST /auth/verify-otp  — verify OTP and receive JWT
router.post("/verify-otp", validatePhone, validateOTP, verifyOTP);

export default router;