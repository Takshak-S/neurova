import request from "supertest";
import app from "../../app";
import { connectTestDB, disconnectTestDB, clearTestDB } from "../helpers/testDB";
import "../helpers/redisMock"; // activates the Redis mock — must be imported before app
import OTPModel from "../../models/OTPSchema.model";
import { smsService } from "../../services/sms.service";

// Mock the SMS service — we never want real SMS sent in tests
jest.mock("../../services/sms.service", () => ({
  smsService: {
    sendOTP: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockSendOTP = smsService.sendOTP as jest.Mock;

describe("POST /api/v1/auth/send-otp", () => {
  beforeAll(async () => await connectTestDB());
  afterAll(async () => await disconnectTestDB());
  afterEach(async () => {
    await clearTestDB();
    mockSendOTP.mockClear();
  });

  // ─── Validation ──────────────────────────────────────────────────────────

  describe("input validation", () => {
    it("should return 400 if phone is missing", async () => {
      const res = await request(app)
        .post("/api/v1/auth/send-otp")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBeDefined();
    });

    it("should return 400 if phone is not E.164 format", async () => {
      const res = await request(app)
        .post("/api/v1/auth/send-otp")
        .send({ phone: "9876543210" }); // missing + and country code

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 for a phone with letters", async () => {
      const res = await request(app)
        .post("/api/v1/auth/send-otp")
        .send({ phone: "+91987654ABCD" });

      expect(res.status).toBe(400);
    });

    it("should return 400 if phone is an empty string", async () => {
      const res = await request(app)
        .post("/api/v1/auth/send-otp")
        .send({ phone: "" });

      expect(res.status).toBe(400);
    });
  });

  // ─── Happy path ──────────────────────────────────────────────────────────

  describe("success", () => {
    it("should return 200 with correct response shape", async () => {
      const res = await request(app)
        .post("/api/v1/auth/send-otp")
        .send({ phone: "+919876543210" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("OTP sent successfully");
      expect(res.body.data.phone).toBe("+919876543210");
      expect(res.body.data.expiresInMinutes).toBe(10);
    });

    it("should create an OTP document in the database", async () => {
      await request(app)
        .post("/api/v1/auth/send-otp")
        .send({ phone: "+919876543210" });

      const otpDoc = await OTPModel.findOne({ phone: "+919876543210" });
      expect(otpDoc).not.toBeNull();
      expect(otpDoc!.attempts).toBe(0);
    });

    it("should store a hashed OTP, not the raw OTP", async () => {
      await request(app)
        .post("/api/v1/auth/send-otp")
        .send({ phone: "+919876543210" });

      const otpDoc = await OTPModel.findOne({ phone: "+919876543210" });
      // hashedOTP should not be 6 digits — it's a bcrypt hash
      expect(otpDoc!.hashedOTP).not.toMatch(/^\d{6}$/);
      expect(otpDoc!.hashedOTP).toMatch(/^\$2[aby]\$.{56}$/); // bcrypt hash pattern
    });

    it("should call smsService.sendOTP once", async () => {
      await request(app)
        .post("/api/v1/auth/send-otp")
        .send({ phone: "+919876543210" });

      expect(mockSendOTP).toHaveBeenCalledTimes(1);
      expect(mockSendOTP).toHaveBeenCalledWith("+919876543210", expect.any(String));
    });

    it("should replace an existing OTP if one already exists", async () => {
      // Send OTP twice for the same number
      await request(app)
        .post("/api/v1/auth/send-otp")
        .send({ phone: "+919876543210" });

      await request(app)
        .post("/api/v1/auth/send-otp")
        .send({ phone: "+919876543210" });

      // Should be exactly one OTP document — the old one was replaced
      const count = await OTPModel.countDocuments({ phone: "+919876543210" });
      expect(count).toBe(1);
    });
  });

  // ─── Rate limiting ───────────────────────────────────────────────────────

  describe("rate limiting", () => {
    it("should return 429 after exceeding the rate limit", async () => {
      const phone = "+919111111111";

      // Make 5 requests (the limit)
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post("/api/v1/auth/send-otp")
          .send({ phone });
      }

      // 6th request should be blocked
      const res = await request(app)
        .post("/api/v1/auth/send-otp")
        .send({ phone });

      expect(res.status).toBe(429);
      expect(res.body.success).toBe(false);
    });

    it("should include rate limit headers in the response", async () => {
      const res = await request(app)
        .post("/api/v1/auth/send-otp")
        .send({ phone: "+919222222222" });

      expect(res.headers["x-ratelimit-limit"]).toBeDefined();
      expect(res.headers["x-ratelimit-remaining"]).toBeDefined();
      expect(res.headers["x-ratelimit-reset"]).toBeDefined();
    });

    it("should not increment the rate limit counter for invalid requests", async () => {
      const phone = "+919333333333";

      // Send 4 invalid requests (wrong format — validation fails before rate limit)
      for (let i = 0; i < 4; i++) {
        await request(app)
          .post("/api/v1/auth/send-otp")
          .send({ phone: "invalid" });
      }

      // Valid request should still succeed — counter was never incremented
      const res = await request(app)
        .post("/api/v1/auth/send-otp")
        .send({ phone });

      expect(res.status).toBe(200);
    });
  });
});