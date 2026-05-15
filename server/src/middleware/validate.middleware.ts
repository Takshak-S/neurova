import { Request, Response, NextFunction } from "express";
import { z, ZodSchema } from "zod";
import { ApiError } from "../utils/ApiError";

// A factory function that returns an Express middleware.
// Usage: router.post('/send-otp', validate(sendOTPSchema), controller)
//
// Why Zod? It gives us runtime type validation + TypeScript inference
// in one step. The validated data is available as req.body with correct types.

export const validate = (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
        // Flatten Zod's error format into a readable message
        const errors = result.error.flatten().fieldErrors as Record<string, string[]>;
        const firstError = Object.values(errors)[0]?.[0] ?? "Invalid input";
        next(ApiError.badRequest(firstError));
        return;
    }

    // Replace req.body with the parsed (sanitized + typed) data
    req.body = result.data;
    next();
};

// ─── Validation schemas ────────────────────────────────────────────────────

// E.164 format: + followed by country code and number, 10-15 digits total
// Examples: +919876543210, +14155552671
const phoneSchema = z.string().regex(
    /^\+[1-9]\d{9,14}$/,
    "Phone must be in E.164 format (e.g., +919876543210)"
);

export const sendOTPSchema = z.object({
    phone: phoneSchema,
});

export const verifyOTPSchema = z.object({
    phone: phoneSchema,
    otp: z.string().length(6, "OTP must be exactly 6 digits").regex(/^\d{6}$/, "OTP must contain only digits"),
});

export const updateProfileSchema = z.object({
    name:z.string().min(1,"Name cannot be empty")
    .max(50, "Name cannot exceed 50 characters").trim().optional(),
    avatar: z.string().url("Avatar must be a valid URL").optional(),
});

export const registerPublicKeySchema = z.object({
    publicKey: z.string().min(1,"Public key is required"),
});