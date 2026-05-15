import crypto from "crypto";

//crypto.randomInt is cryptographically secure - unlike Math.random()
//which is Not suitable for security-sensitive values like OTPs.
//Range: 100000 to 999999 (always 6 digits, never starts with 0)

export const generateOTP = ():string=>{
    return crypto.randomInt(100000,999999).toString();
}