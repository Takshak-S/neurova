import bcrypt from "bcryptjs";
import OTPSchemaModel from "../models/OTPSchema.model";
import {env} from "../config/env";
import {generateOTP} from "../utils/generateOTP";
import {ApiError} from "../utils/ApiError";

// All OTP operations live here.
// The controller calls this service — it never touches the OTP model directly.
// This separation means if we change how OTPs work (e.g., switch from MongoDB
// to Redis for storage), we only change this file.

export const otpService = {
  // Creates a new OTP for a phone number.
  // Deletes any existing OTP for this phone first — one active OTP at a time.
  // Returns the raw OTP so it can be sent via SMS.
  async createOTP(phone:string):Promise<string> {
    const rawOTP = generateOTP();

    //bcrypt cost factor 10 = ~100ms on modern hardware.
    //High enough to make brute-force expensive, low enough to not slow the API.
    const hashedOTP = await bcrypt.hash(rawOTP,10);

    const expiresAt = new Date(
        Date.now()+env.otp.expiryMinutes*60*1000
    );
   
    await OTPSchemaModel.deleteOne({phone});

    await OTPSchemaModel.create({
        phone,
        hashedOTP,
        expiresAt,
        attempts: 0,
    });

    return rawOTP;
   },

   async verifyOTP(phone:string, submittedOTP:string):Promise<boolean>{
    const otpDoc=await OTPSchemaModel.findOne({phone});

    if(!otpDoc) {
        throw ApiError.badRequest(
            "OTP not found or expired. Please request a new one."
        );
    }

    // Double-check expiry in the service layer.
    // The MongoDB TTL index can lag by up to 60s — don't rely on it alone.  
    if (otpDoc.expiresAt < new Date()) {
        await OTPSchemaModel.deleteOne({phone});
        throw ApiError.badRequest("OTP has expired. Please request a new one.");
    }  

    //check attempts count before comparing - fail fast, don't waste bcrypt time
    if(otpDoc.attempts>=env.otp.maxAttempts) {
        await OTPSchemaModel.deleteOne({phone});
        throw ApiError.tooManyRequests(
            "Maximum OTP attempts exceeded. Please request a new one."
        );
    }

    const isMatch = await bcrypt.compare(submittedOTP, otpDoc.hashedOTP);

    if(!isMatch) {
      // Increment the attempt counter atomically using findOneAndUpdate.
      // Do NOT do: otpDoc.attempts++; otpDoc.save();
      // That's a read-modify-write pattern — vulnerable to race conditions
      // if the same user submits two requests simultaneously.
      await OTPSchemaModel.findOneAndUpdate(
        {phone},
        {$inc: {attempts:1}}
      ) ;

      const remainingAttempts = env.otp.maxAttempts- (otpDoc.attempts+1);
      throw ApiError.unauthorized(
        `Invalid OTP. ${remainingAttempts} attempt${remainingAttempts!==1?"s":""} remaining.`
      );
    }

    await OTPSchemaModel.deleteOne({phone});

    return true;
   },

}