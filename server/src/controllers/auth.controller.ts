import {Request, Response} from "express";
import {otpService} from "../services/otp.service";
import {smsService} from "../services/sms.service";
import {tokenService} from "../services/token.service";
import UserModel from "../models/User.model";
import {ApiResponse} from "../utils/ApiResponse";

// Controllers are intentionally thin.
// They handle HTTP concerns (req, res) and delegate ALL business logic to services.
// Rule of thumb: if a controller method exceeds ~20 lines, move logic to a service.

export const authController = {
  // POST /auth/send-otp
  // Generates an OTP and sends it via SMS.
  // Rate limiting and validation happen in middleware before this runs.

  async sendOTP(req:Request,res:Response): Promise<void> {
    const {phone} = req.body;

    const rawOTP = await otpService.createOTP(phone);

    await smsService.sendOTP(phone,rawOTP);

    res.status(200).json(
        new ApiResponse("OTP sent successfully", {
            phone,
            expiresInMinutes: 10,
        })
    );
  },
  // POST /auth/verify-otp
  // Verifies the OTP. On success, creates the user if new and returns a JWT.
  async verifyOTP(req:Request, res:Response):Promise<void> {
    const {phone, otp} = req.body; // validated by verifyOTPSchema middleware

    // Throws ApiError if invalid — caught by error middleware
    await otpService.verifyOTP(phone,otp);

    // Find existing user or create a new one.
    // findOneAndUpdate with upsert:true is atomic — safe against race conditions
    // where two requests try to create the same user simultaneously.
    const user = await UserModel.findOneAndUpdate(
        {phone},
        { $setOnInsert : {phone}}, // only set phone on INSERT, not on UPDATE
        {
            upsert: true, // create if doesn't exist
            returnDocument: "after", // return the document after update
            setDefaultsOnInsert: true, // apply schema defaults on insert
        }
    );

    const token = tokenService.sign(user!._id, user!.phone);

    const isNewUser = !user!.name; //new users haven't set a name yet

    res.status(200).json(
        new ApiResponse("Verification successful", {
            token, 
            isNewUser,
            user: {
                id: user!._id,
                phone: user!.phone,
                name: user!.name,
                avatar: user!.avatar,
                publicKey: user!.publicKey,
            },
        })
    );
  },

  // POST /auth/refresh
  // Issues a new token from a valid existing token.
  // Useful when the client detects a token expiring soon.
  async refreshToken(req:Request,res:Response):Promise<void> {
    //req.user is set by authMiddleware
    const user=req.user!;
    const token = tokenService.sign(user._id,user.phone);

    res.status(200).json(
        new ApiResponse("Token refreshed", { token })
    );
  },

  // GET /auth/me
  // Returns the currently authenticated user's profile.
  async getMe(req:Request,res:Response):Promise<void> {
    const user = req.user;

    res.status(200).json(
        new ApiResponse("User fetched", {
            id: user?._id,
            phone: user?.phone,
            name: user?.name,
            avatar: user?.avatar,
            publicKey: user?.publicKey,
            lastSeen: user?.lastSeen,
        })
    );
  }, 
};

