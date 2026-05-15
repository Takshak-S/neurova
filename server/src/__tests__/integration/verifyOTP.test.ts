import request from "supertest";
import app from "../../app";
import { connectTestDB, disconnectTestDB, clearTestDB } from "../helpers/testDB";
import "../helpers/redisMock";
import {
  createTestOTP,
  createExpiredOTP,
  createMaxAttemptsOTP,
  TEST_PHONE,
  TEST_OTP,
} from "../helpers/factories";
import UserModel from "../../models/User.model";
import OTPModel from "../../models/OTPSchema.model";

jest.mock("../../services/sms.service", () => ({
  smsService: { sendOTP: jest.fn().mockResolvedValue(undefined) },
}));

describe("POST /api/v1/auth/verify-otp", () => {
  beforeAll(async () => await connectTestDB());
  afterAll(async () => await disconnectTestDB());
  afterEach(async () => await clearTestDB());

  // ─── Validation ──────────────────────────────────────────────────────────

  describe("input validation", () => {
    it("should return 400 if phone is missing", async () => {
      const res = await request(app)
        .post("/api/v1/auth/verify-otp")
        .send({ otp: "123456" });

      expect(res.status).toBe(400);
    });

    it("should return 400 if otp is missing", async () => {
      const res = await request(app)
        .post("/api/v1/auth/verify-otp")
        .send({ phone: TEST_PHONE });

      expect(res.status).toBe(400);
    });

    it("should return 400 if OTP is not exactly 6 digits", async () => {
      const res = await request(app)
        .post("/api/v1/auth/verify-otp")
        .send({ phone: TEST_PHONE, otp: "12345" }); // 5 digits

      expect(res.status).toBe(400);
    });

    it("should return 400 if OTP contains non-digits", async () => {
      const res = await request(app)
        .post("/api/v1/auth/verify-otp")
        .send({ phone: TEST_PHONE, otp: "12345A" });

      expect(res.status).toBe(400);
    });
  });

  // ─── Happy path: new user ─────────────────────────────────────────────────

  describe("new user registration", () => {
    it("should return 200 with a JWT token", async () => {
      await createTestOTP();

      const res = await request(app)
        .post("/api/v1/auth/verify-otp")
        .send({ phone: TEST_PHONE, otp: TEST_OTP });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(typeof res.body.data.token).toBe("string");
    });

    it("should set isNewUser to true for a first-time phone number", async () => {
      await createTestOTP();

      const res = await request(app)
        .post("/api/v1/auth/verify-otp")
        .send({ phone: TEST_PHONE, otp: TEST_OTP });

      expect(res.body.data.isNewUser).toBe(true);
    });

    it("should create a User document in the database", async () => {
      await createTestOTP();

      await request(app)
        .post("/api/v1/auth/verify-otp")
        .send({ phone: TEST_PHONE, otp: TEST_OTP });

      const user = await UserModel.findOne({ phone: TEST_PHONE });
      expect(user).not.toBeNull();
      expect(user!.phone).toBe(TEST_PHONE);
    });

    it("should delete the OTP document after successful verification", async () => {
      await createTestOTP();

      await request(app)
        .post("/api/v1/auth/verify-otp")
        .send({ phone: TEST_PHONE, otp: TEST_OTP });

      const otpDoc = await OTPModel.findOne({ phone: TEST_PHONE });
      expect(otpDoc).toBeNull();
    });

    it("should return user data without sensitive fields", async () => {
      await createTestOTP();

      const res = await request(app)
        .post("/api/v1/auth/verify-otp")
        .send({ phone: TEST_PHONE, otp: TEST_OTP });

      const { user } = res.body.data;
      expect(user.id).toBeDefined();
      expect(user.phone).toBe(TEST_PHONE);
      // hashedOTP, deviceTokens, __v must never appear in any response
      expect(user.hashedOTP).toBeUndefined();
      expect(user.deviceTokens).toBeUndefined();
      expect(user.__v).toBeUndefined();
    });
  });

  // ─── Happy path: returning user ──────────────────────────────────────────

  describe("returning user login", () => {
    it("should set isNewUser to false for an existing user", async () => {
      // Pre-create a user with a name (indicating they've completed onboarding)
      await UserModel.create({ phone: TEST_PHONE, name: "Existing User" });
      await createTestOTP();

      const res = await request(app)
        .post("/api/v1/auth/verify-otp")
        .send({ phone: TEST_PHONE, otp: TEST_OTP });

      expect(res.body.data.isNewUser).toBe(false);
    });

    it("should not create a duplicate user on re-login", async () => {
      await UserModel.create({ phone: TEST_PHONE, name: "Existing User" });
      await createTestOTP();

      await request(app)
        .post("/api/v1/auth/verify-otp")
        .send({ phone: TEST_PHONE, otp: TEST_OTP });

      const count = await UserModel.countDocuments({ phone: TEST_PHONE });
      expect(count).toBe(1); // must still be 1, not 2
    });
  });

  // ─── Error cases ──────────────────────────────────────────────────────────

  describe("error handling", () => {
    it("should return 400 if no OTP was sent for this phone", async () => {
      // No OTP document in DB — as if /send-otp was never called
      const res = await request(app)
        .post("/api/v1/auth/verify-otp")
        .send({ phone: TEST_PHONE, otp: "123456" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 if the OTP has expired", async () => {
      await createExpiredOTP();

      const res = await request(app)
        .post("/api/v1/auth/verify-otp")
        .send({ phone: TEST_PHONE, otp: TEST_OTP });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("expired");
    });

    it("should return 401 for a wrong OTP", async () => {
      await createTestOTP();

      const res = await request(app)
        .post("/api/v1/auth/verify-otp")
        .send({ phone: TEST_PHONE, otp: "000000" }); // wrong OTP

      expect(res.status).toBe(401);
      expect(res.body.message).toContain("Invalid OTP");
    });

    it("should return 429 when max attempts are exceeded", async () => {
      await createMaxAttemptsOTP();

      const res = await request(app)
        .post("/api/v1/auth/verify-otp")
        .send({ phone: TEST_PHONE, otp: TEST_OTP });

      expect(res.status).toBe(429);
    });

    it("should increment attempt count on each wrong guess", async () => {
      await createTestOTP();

      await request(app)
        .post("/api/v1/auth/verify-otp")
        .send({ phone: TEST_PHONE, otp: "000000" });

      const otpDoc = await OTPModel.findOne({ phone: TEST_PHONE });
      expect(otpDoc!.attempts).toBe(1);
    });

    it("should not increment attempts on correct OTP", async () => {
      await createTestOTP();

      await request(app)
        .post("/api/v1/auth/verify-otp")
        .send({ phone: TEST_PHONE, otp: TEST_OTP });

      // OTP doc should be deleted, not updated
      const otpDoc = await OTPModel.findOne({ phone: TEST_PHONE });
      expect(otpDoc).toBeNull();
    });
  });
});