import { Request,Response,NextFunction } from "express";
import {ApiError} from "../utils/ApiError";
import {env} from "../config/env";


// Central error handler — the last middleware in the Express chain.
// Any error passed to next(error) lands here.
// This is why asyncHandler wraps every async route handler.
//
// IMPORTANT: Express identifies error-handling middleware by the
// 4-parameter signature (err, req, res, next). All four are required,
// even if next isn't used — removing it breaks Express's error routing.

export const errorMiddleware = (
    err: Error,
    req: Request,
    res:Response,
    _next: NextFunction //must be present even if unused
):void=>{
    //Operational errors (ApiError) are expected and safe to expose
    if(err instanceof ApiError) {
        res.status(err.statusCode).json({
            success:false,
            message: err.message,
            //Only include stack trace in development - never in production
            ...(env.nodeEnv==="development" && {stack:err.stack} ),
        });
        return;
    }

    //Mongoose duplicate key error (e.g. registering same phone twice)
    if((err as any).code===11000) {
        const field=Object.keys((err as any).keyValue || {})[0]??"field";
        res.status(409).json({
            success:false,
            message: `${field} already exists`,
        });
        return;
    }

    //Mongoose validation error
    if (err.name=="ValidationError") {
        res.status(400).json({
            success:false,
            message:err.message,
        });
        return;
    }

    //Unknown/programmer error - log it, don't expose internals to client
    console.error("Unhandled error:",err);
    res.status(500).json({
        success:false,
        message: env.isProduction
        ? "Something went wrong. Please try again."
        :err.message,
        ...(env.nodeEnv==="development" && {stack:err.stack}),
    });
};