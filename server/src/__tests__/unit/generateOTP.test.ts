import { generateOTP } from "../../utils/generateOTP";

// Unit tests for generateOTP.
// These are pure function tests — no DB, no Redis, no mocks needed.
// Fast, isolated, run in milliseconds.

describe("generateOTP", ()=>{
    it("should return a 6-digit string", ()=>{
        const otp = generateOTP();
        expect(otp).toHaveLength(6);
    });

    it("should contain only digits", ()=>{
        const otp=generateOTP();
        expect(otp).toMatch(/^\d{6}$/);
    });

    it("should always be at least 100000 (never starts with leading zero)", ()=>{
        //Run 100 times to reduce false-positive probabilitiy
        for(let i=0;i<100;i++) {
            const otp=generateOTP();
            expect(parseInt(otp,10)).toBeGreaterThanOrEqual(100000);
        }
    });

    it("should not always return the same value (basic randomness check)", () => {
        const otps = new Set(Array.from({ length: 20 }, () => generateOTP()));
        // With 900000 possible values, 20 draws should produce > 1 unique value
        expect(otps.size).toBeGreaterThan(1);
    });
    
    it("should return a string, not a number", () => {
        const otp = generateOTP();
        expect(typeof otp).toBe("string");
    });
});
