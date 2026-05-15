import twilio from "twilio";
import {env} from "../config/env";

// Wrap Twilio behind a service interface.
// If we ever switch from Twilio to MSG91 or AWS SNS, we change this file only.
// The rest of the codebase calls smsService.sendOTP() and doesn't know or care
// which SMS provider is underneath.

const client = twilio(env.twilio.accountSid,env.twilio.authToken);

export const smsService = {
    async sendOTP(phone:string,otp:string):Promise<void> {
        // In development, skip the actual SMS and log to console.
        // This avoids burning Twilio credits during local development.
        if (!env.isProduction) {
            console.log(`\n📱 [DEV] OTP for ${phone}: ${otp}\n`)
            return;
        }

        await client.messages.create({
            body:`Your Neurova verification code is ${otp}. Valid for ${env.otp.expiryMinutes} minutes. Do not share this code with anyone.`,
            from: env.twilio.phoneNumber,
            to:phone,
        });
    },
};
