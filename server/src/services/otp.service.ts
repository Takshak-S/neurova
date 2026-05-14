import crypto from "crypto";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

/**
 * Generate a cryptographically random 6-digit OTP.
 */
export const generateOTP = (): string => {
    // crypto.randomInt is rejection-sampled → no modulo bias
    return crypto.randomInt(100_000, 999_999).toString();
};

/**
 * Hash an OTP for safe storage in MongoDB.
 */
export const hashOTP = async (otp: string): Promise<string> => {
    return bcrypt.hash(otp, SALT_ROUNDS);
};

/**
 * Compare a raw OTP against its bcrypt hash.
 */
export const compareOTP = async (
    rawOTP: string,
    hashedOTP: string
): Promise<boolean> => {
    return bcrypt.compare(rawOTP, hashedOTP);
};
