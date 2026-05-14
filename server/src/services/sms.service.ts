import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

if (!accountSid || !authToken || !fromNumber) {
    console.warn(
        "WARNING: Twilio credentials not fully configured. SMS sending will fail."
    );
}

const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

/**
 * Send an OTP via SMS using Twilio.
 */
export const sendOTPviaSMS = async (
    phone: string,
    otp: string
): Promise<void> => {
    if (!client || !fromNumber) {
        // In development, log the OTP instead of sending
        console.log(`[DEV SMS] OTP for ${phone}: ${otp}`);
        return;
    }

    await client.messages.create({
        body: `Your Neurova verification code is: ${otp}. It expires in 5 minutes.`,
        from: fromNumber,
        to: phone,
    });
};
