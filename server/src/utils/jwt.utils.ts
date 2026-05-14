import jwt, { Secret, SignOptions } from "jsonwebtoken";

const JWT_SECRET: Secret = process.env.JWT_SECRET || "change-me-in-production";
const JWT_EXPIRES_IN: SignOptions["expiresIn"] =
    (process.env.JWT_EXPIRES_IN as SignOptions["expiresIn"]) || "7d";

export interface JWTPayload {
    userId: string;
}

/**
 * Sign a JWT containing the user's MongoDB _id.
 */
export const signToken = (userId: string): string => {
    return jwt.sign({ userId } as JWTPayload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
    });
};

/**
 * Verify and decode a JWT. Throws if invalid or expired.
 */
export const verifyToken = (token: string): JWTPayload => {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
};
