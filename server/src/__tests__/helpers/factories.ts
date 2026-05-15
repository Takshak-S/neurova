import bcrypt from "bcryptjs";
import OTPSchemaModel from "../../models/OTPSchema.model";
import UserModel from "../../models/User.model";
import { tokenService } from "../../services/token.service";
import { Types } from "mongoose";

// Test factories keep test data creation DRY and consistent.
// Instead of repeating document creation logic in every test,
// call these factories and override only what the test cares about.

export const TEST_PHONE = "+919876543210";
export const TEST_OTP = "123456";
export const TEST_NAME = "Test User";

export const createTestUser = async (overrides: Partial<{
  phone: string;
  name: string;
  publicKey: string;
}> = {}) => {
  return UserModel.create({
    phone: overrides.phone ?? TEST_PHONE,
    name: overrides.name ?? TEST_NAME,
    publicKey: overrides.publicKey ?? undefined,
  });
};

// Creates a valid OTP document in the test DB
export const createTestOTP = async (overrides: Partial<{
  phone: string;
  otp: string;
  expiresAt: Date;
  attempts: number;
}> = {}) => {
  const rawOTP = overrides.otp ?? TEST_OTP;
  const hashedOTP = await bcrypt.hash(rawOTP, 10);
 
  return OTPSchemaModel.create({
    phone: overrides.phone ?? TEST_PHONE,
    hashedOTP,
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 10 * 60 * 1000),
    attempts: overrides.attempts ?? 0,
  });
};

// Creates an expired OTP (expiresAt in the past)
export const createExpiredOTP = async (phone = TEST_PHONE) => {
  return createTestOTP({
    phone,
    expiresAt: new Date(Date.now() - 1000), // 1 second in the past
  });
};

// Creates an OTP with max attempts already reached
export const createMaxAttemptsOTP = async (phone = TEST_PHONE) => {
  return createTestOTP({ phone, attempts: 5 });
};

// Returns a valid JWT for a test user — for protected route tests
export const getTestToken = async (userId?: Types.ObjectId, phone = TEST_PHONE): Promise<string> => {
  const id = userId ?? new Types.ObjectId();
  return tokenService.sign(id, phone);
};

// Returns a valid Authorization header string
export const getAuthHeader = async (userId?: Types.ObjectId, phone = TEST_PHONE) => {
  const token = await getTestToken(userId, phone);
  return { Authorization: `Bearer ${token}` };
};