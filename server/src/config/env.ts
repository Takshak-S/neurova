import dotenv from "dotenv";
import { parse } from "node:path";
import { Parameter } from "twilio/lib/twiml/VoiceResponse";
import {z} from "zod";

dotenv.config();

// Define the shape and constraints of every env variable the app needs.
// The app will refuse to start if any of these are missing or invalid.
// This pattern is called "fail fast" — better to crash at startup than
// fail silently mid-request with a cryptic error.

const envSchema = z.object({
    PORT: z.string().default("5000"),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

    MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
    REDIS_URL: z.string().min(1,"REDIS_URL is required"),

    JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
    JWT_EXPIRES_IN: z.string().default("7d"),

    TWILIO_ACCOUNT_SID: z.string().min(1, "TWILIO_ACCOUNT_SID is required"),
    TWILIO_AUTH_TOKEN: z.string().min(1, "TWILIO_AUTH_TOKEN is required"),
    TWILIO_PHONE_NUMBER: z.string().min(1, "TWILIO_PHONE_NUMBER is required"),

    OTP_EXPIRY_MINUTES: z.string().default("10"),
    OTP_MAX_ATTEMPTS: z.string().default("5"),
    OTP_RATE_LIMIT_WINDOW_MINUTES: z.string().default("10"),
    OTP_RATE_LIMIT_MAX_REQUESTS: z.string().default("5"),

    ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),
});

const parsed = envSchema.safeParse(process.env);

if(!parsed.success) {
    console.error("❌ Invalid environment variables:");
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1); // hard stop — do not start the server
}

export const env = {
    port: parseInt(parsed.data.PORT, 10),
    nodeEnv: parsed.data.NODE_ENV,
    isProduction: parsed.data.NODE_ENV === "production",

    mongodbUri: parsed.data.MONGODB_URI,
    redisUrl: parsed.data.REDIS_URL,

    jwt: {
        secret: parsed.data.JWT_SECRET,
        expiresIn: parsed.data.JWT_EXPIRES_IN,
    },

    twilio: {
        accountSid: parsed.data.TWILIO_ACCOUNT_SID,
        authToken: parsed.data.TWILIO_AUTH_TOKEN,
        phoneNumber: parsed.data.TWILIO_PHONE_NUMBER,
    },

    otp: {
        expiryMinutes: parseInt(parsed.data.OTP_EXPIRY_MINUTES,10),
        maxAttempts: parseInt(parsed.data.OTP_MAX_ATTEMPTS,10),
        rateLimitWindowMinutes: parseInt(parsed.data.OTP_RATE_LIMIT_WINDOW_MINUTES,10),
        rateLimitMaxRequests: parseInt(parsed.data.OTP_RATE_LIMIT_MAX_REQUESTS,10),
    },

    allowedOrigins: parsed.data.ALLOWED_ORIGINS.split(","),
};