import { Request, Response } from "express";
import OTP from "../models/OTPSchema.model";
import User from "../models/User.model";
import { generateOTP, hashOTP, compareOTP } from "../services/otp.service";
import { sendOTPviaSMS } from "../services/sms.service";
import { checkOTPRateLimit } from "../services/rateLimit.service";
import { signToken } from "../utils/jwt.utils";

const OTP_EXPIRY_MINUTES = 5;
const MAX_VERIFY_ATTEMPTS = 5;

/**
 * POST /auth/send-otp
 * Body: { phone: string }
 */
export const sendOTP = async (req: Request, res: Response): Promise<void> => {
    try {
        const { phone } = req.body;

        if (!phone) {
            res.status(400).json({ message: "Phone number is required" });
            return;
        }

        // 1. Rate-limit check (Redis)
        const rateLimit = await checkOTPRateLimit(phone);
        if (!rateLimit.allowed) {
            res.status(429).json({
                message: "Too many OTP requests. Please try again later.",
                retryAfter: rateLimit.retryAfter,
            });
            return;
        }

        // 2. Generate & hash OTP
        const rawOTP = generateOTP();
        const hashedOTP = await hashOTP(rawOTP);

        // 3. Upsert OTP document (one active OTP per phone)
        const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

        await OTP.findOneAndUpdate(
            { phone },
            {
                otp: hashedOTP,
                expiresAt,
                attempts: 0,
            },
            { upsert: true, new: true }
        );

        // 4. Send raw OTP via SMS (Twilio)
        await sendOTPviaSMS(phone, rawOTP);

        // 5. Respond
        res.status(200).json({
            message: "OTP sent successfully",
            expiresIn: OTP_EXPIRY_MINUTES * 60, // seconds
        });
    } catch (error) {
        console.error("sendOTP error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

/**
 * POST /auth/verify-otp
 * Body: { phone: string, otp: string }
 */
export const verifyOTP = async (req: Request, res: Response): Promise<void> => {
    try {
        const { phone, otp } = req.body;

        if (!phone || !otp) {
            res.status(400).json({ message: "Phone and OTP are required" });
            return;
        }

        // 1. Find the OTP document
        const otpDoc = await OTP.findOne({ phone });

        if (!otpDoc) {
            res.status(400).json({
                message: "OTP expired or was never sent. Please request a new one.",
            });
            return;
        }

        // 2. Check brute-force attempts
        if (otpDoc.attempts >= MAX_VERIFY_ATTEMPTS) {
            // Delete the OTP document to force a fresh request
            await OTP.deleteOne({ _id: otpDoc._id });
            res.status(429).json({
                message: "Too many failed attempts. Please request a new OTP.",
            });
            return;
        }

        // 3. Compare submitted OTP against hash
        const isMatch = await compareOTP(otp, otpDoc.otp);

        if (!isMatch) {
            // Increment attempts counter
            await OTP.updateOne(
                { _id: otpDoc._id },
                { $inc: { attempts: 1 } }
            );
            res.status(401).json({
                message: "Invalid OTP",
                attemptsRemaining: MAX_VERIFY_ATTEMPTS - (otpDoc.attempts + 1),
            });
            return;
        }

        // 4. OTP is correct — delete the document
        await OTP.deleteOne({ _id: otpDoc._id });

        // 5. Find or create the user
        let user = await User.findOne({ phone });
        if (!user) {
            user = await User.create({ phone });
        }

        // 6. Sign JWT
        const token = signToken(user._id.toString());

        res.status(200).json({
            message: "Phone verified successfully",
            token,
            user: {
                _id: user._id,
                phone: user.phone,
                name: user.name,
                avatar: user.avatar,
            },
        });
    } catch (error) {
        console.error("verifyOTP error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
