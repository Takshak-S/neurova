import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt.utils";
import User, { IUser } from "../models/User.model";

// Extend Express Request to include `user`
declare global {
    namespace Express {
        interface Request {
            user?: IUser;
        }
    }
}

/**
 * Middleware that protects routes by verifying the JWT
 * in the Authorization header (Bearer <token>).
 */
export const authMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            res.status(401).json({ message: "Access denied. No token provided." });
            return;
        }

        const token = authHeader.split(" ")[1];
        const decoded = verifyToken(token);

        // Load the full user document so downstream handlers have it
        const user = await User.findById(decoded.userId).select("-__v");

        if (!user) {
            res.status(401).json({ message: "User not found. Token is invalid." });
            return;
        }

        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ message: "Invalid or expired token." });
    }
};
