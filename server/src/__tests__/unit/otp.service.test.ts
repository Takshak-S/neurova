import { otpService } from "../../services/otp.service";
import { ApiError } from "../../utils/ApiError";
import OTPModel from "../../models/OTPSchema.model";
import bcrypt from "bcryptjs";

// We mock mongoose model methods so this test has zero DB dependency.
// This is "pure unit" — we're testing the service logic, not mongoose.
// Integration tests (below) will test the full stack including real DB.

jest.mock("../../models/OTPSchema.model");
jest.mock("bcryptjs");

const mockOTPModel = OTPModel as jest.Mocked<typeof OTPModel>;
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe("otpService", () => {
  const phone = "+919876543210";

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: bcrypt hash returns a fake hash
    (mockBcrypt.hash as jest.Mock).mockResolvedValue("hashed_otp");
  });

  // ─── createOTP ────────────────────────────────────────────────────────────

  describe("createOTP()", () => {
    beforeEach(() => {
      (mockOTPModel.deleteOne as jest.Mock).mockResolvedValue({ deletedCount: 1 });
      (mockOTPModel.create as jest.Mock).mockResolvedValue({
        phone,
        hashedOTP: "hashed_otp",
        expiresAt: new Date(),
        attempts: 0,
      });
    });

    it("should delete any existing OTP before creating a new one", async () => {
      await otpService.createOTP(phone);
      expect(mockOTPModel.deleteOne).toHaveBeenCalledWith({ phone });
    });

    it("should hash the OTP before saving", async () => {
      await otpService.createOTP(phone);
      expect(mockBcrypt.hash).toHaveBeenCalledWith(expect.any(String), 10);
    });

    it("should save the hashed OTP, not the raw OTP", async () => {
      await otpService.createOTP(phone);
      expect(mockOTPModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ hashedOTP: "hashed_otp" })
      );
    });

    it("should return a 6-digit raw OTP string", async () => {
      const otp = await otpService.createOTP(phone);
      expect(otp).toMatch(/^\d{6}$/);
    });

    it("should set expiresAt 10 minutes in the future", async () => {
      const before = Date.now();
      await otpService.createOTP(phone);
      const after = Date.now();

      const createCall = (mockOTPModel.create as jest.Mock).mock.calls[0][0];
      const expiresAt = createCall.expiresAt.getTime();

      // expiresAt should be ~10 minutes from now (within a 1s tolerance)
      expect(expiresAt).toBeGreaterThan(before + 9 * 60 * 1000);
      expect(expiresAt).toBeLessThan(after + 11 * 60 * 1000);
    });
  });

  // ─── verifyOTP ───────────────────────────────────────────────────────────

  describe("verifyOTP()", () => {
    const validOTPDoc = {
      phone,
      hashedOTP: "hashed_otp",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
      attempts: 0,
    };

    it("should throw 400 if no OTP document exists for the phone", async () => {
      (mockOTPModel.findOne as jest.Mock).mockResolvedValue(null);

      await expect(otpService.verifyOTP(phone, "123456")).rejects.toThrow(
        ApiError
      );
      await expect(otpService.verifyOTP(phone, "123456")).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("should throw 400 and delete the document if OTP is expired", async () => {
      (mockOTPModel.findOne as jest.Mock).mockResolvedValue({
        ...validOTPDoc,
        expiresAt: new Date(Date.now() - 1000), // 1 second ago
      });
      (mockOTPModel.deleteOne as jest.Mock).mockResolvedValue({});

      await expect(otpService.verifyOTP(phone, "123456")).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining("expired"),
      });

      expect(mockOTPModel.deleteOne).toHaveBeenCalledWith({ phone });
    });

    it("should throw 429 and delete if attempts >= maxAttempts (5)", async () => {
      (mockOTPModel.findOne as jest.Mock).mockResolvedValue({
        ...validOTPDoc,
        attempts: 5,
      });
      (mockOTPModel.deleteOne as jest.Mock).mockResolvedValue({});

      await expect(otpService.verifyOTP(phone, "123456")).rejects.toMatchObject({
        statusCode: 429,
      });

      expect(mockOTPModel.deleteOne).toHaveBeenCalledWith({ phone });
    });

    it("should throw 401 and increment attempts on wrong OTP", async () => {
      (mockOTPModel.findOne as jest.Mock).mockResolvedValue(validOTPDoc);
      (mockBcrypt.compare as jest.Mock).mockResolvedValue(false);
      (mockOTPModel.findOneAndUpdate as jest.Mock).mockResolvedValue({});

      await expect(otpService.verifyOTP(phone, "000000")).rejects.toMatchObject({
        statusCode: 401,
      });

      // Atomic increment — not a direct assignment
      expect(mockOTPModel.findOneAndUpdate).toHaveBeenCalledWith(
        { phone },
        { $inc: { attempts: 1 } }
      );
    });

    it("should delete the OTP and return true on correct OTP", async () => {
      (mockOTPModel.findOne as jest.Mock).mockResolvedValue(validOTPDoc);
      (mockBcrypt.compare as jest.Mock).mockResolvedValue(true);
      (mockOTPModel.deleteOne as jest.Mock).mockResolvedValue({});

      const result = await otpService.verifyOTP(phone, "123456");

      expect(result).toBe(true);
      expect(mockOTPModel.deleteOne).toHaveBeenCalledWith({ phone });
    });

    it("should tell the user how many attempts remain on wrong OTP", async () => {
      (mockOTPModel.findOne as jest.Mock).mockResolvedValue({
        ...validOTPDoc,
        attempts: 3, // 4th wrong attempt → 1 remaining
      });
      (mockBcrypt.compare as jest.Mock).mockResolvedValue(false);
      (mockOTPModel.findOneAndUpdate as jest.Mock).mockResolvedValue({});

      await expect(otpService.verifyOTP(phone, "000000")).rejects.toMatchObject({
        message: expect.stringContaining("1 attempt remaining"),
      });
    });
  });
});