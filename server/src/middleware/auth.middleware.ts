import {Request, Response, NextFunction} from "express";
import {tokenService} from "../services/token.service";
import UserModel from "../models/User.model";
import {ApiError} from "../utils/ApiError";
import {IUser} from "../models/User.model";

// Extend Express's Request type to include the authenticated user.
// This is defined globally in src/types/express.d.ts but documented here for clarity.
// After this middleware runs, req.user is guaranteed to be a full User document.

export const authMiddleware = async (
    req: Request,
    res:Response,
    next: NextFunction
):Promise<void> => {
    //Standard Bearer token format: "Authorization: Bearer <token>"
    const authHeader = req.headers.authorization;

    if(!authHeader?.startsWith("Bearer ")) {
        next(ApiError.unauthorized("No token provided"));
        return;
    }

    const token = authHeader.split(" ")[1];

    //verify() throws ApiError.unauthorized on invalid/expirred tokens
    const payload = tokenService.verify(token);

    //Fetch the user from DB to ensure they still exist.
    //Token could be valid but user could have been deleted.
    //.select("-deviceTokens") stips the device tokens from the response
    // - they're internal and never needed by request handlers

    const user = await UserModel.findById(payload.userId).select("-deviceTokens");

    if(!user) {
        next(ApiError.unauthorized("User no longer exists"));
        return;
    }

    //Attach user to request - available in all downstream handlers
    req.user = user as IUser;
    next();
}