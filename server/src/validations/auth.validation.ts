import { Request, Response, NextFunction } from "express";

/**
 * Validates phone number format.
 * Accepts E.164 format: +[country code][number], 7-15 digits total.
 */
export const validatePhone = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    const { phone } = req.body;

    if (!phone || typeof phone !== "string") {
        res.status(400).json({ message: "Phone number is required" });
        return;
    }

    // E.164 format: + followed by 7–15 digits
    const e164Regex = /^\+[1-9]\d{6,14}$/;

    if (!e164Regex.test(phone.trim())) {
        res.status(400).json({
            message:
                "Invalid phone number format. Use E.164 format: +[country code][number]",
        });
        return;
    }

    // Normalize the phone in the body
    req.body.phone = phone.trim();
    next();
};

/**
 * Validates that the OTP is a 6-digit string.
 */
export const validateOTP = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    const { otp } = req.body;

    if (!otp || typeof otp !== "string") {
        res.status(400).json({ message: "OTP is required" });
        return;
    }

    if (!/^\d{6}$/.test(otp.trim())) {
        res.status(400).json({ message: "OTP must be a 6-digit number" });
        return;
    }

    req.body.otp = otp.trim();
    next();
};
