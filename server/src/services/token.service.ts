import jwt from "jsonwebtoken";
import {env} from "../config/env";
import {ApiError} from "../utils/ApiError";
import {Types} from "mongoose";

export interface TokenPayload {
    userId: string,
    phone: string 
}

export const tokenService = {
  // Signs a JWT with the user's ID and phone.
  // The payload is readable by anyone with the token (it's base64, not encrypted).
  // The signature is what proves it was issued by our server.
  // Never put sensitive data (passwords, secrets) in the payload.
  sign(userId: Types.ObjectId, phone:string):string {
    return jwt.sign(
        {userId:userId.toString(),phone} satisfies TokenPayload,
        env.jwt.secret,
        {expiresIn: env.jwt.expiresIn} as jwt.SignOptions
    );
  },

  // Verifies the token's signature and checks it hasn't expired.
  // Throws ApiError.unauthorized if invalid — caught by error middleware.
  verify(token:string):TokenPayload {
    try {
        return jwt.verify(token,env.jwt.secret) as TokenPayload;
    }catch (error){
        if (error instanceof jwt.TokenExpiredError) {
            throw ApiError.unauthorized("Session expired. Please log in again.");
        }
        if (error instanceof jwt.JsonWebTokenError) {
            throw ApiError.unauthorized("Invalid token.");
        }
        throw ApiError.unauthorized("Authencation failed.");
    }
  },
};