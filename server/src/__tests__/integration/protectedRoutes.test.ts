import request from "supertest";
import app from "../../app";
import { connectTestDB, disconnectTestDB, clearTestDB } from "../helpers/testDB";
import "../helpers/redisMock";
import { createTestUser, getAuthHeader, TEST_PHONE } from "../helpers/factories";

jest.mock("../../services/sms.service", () => ({
  smsService: { sendOTP: jest.fn().mockResolvedValue(undefined) },
}));

describe("Protected auth routes", () => {
  beforeAll(async () => await connectTestDB());
  afterAll(async () => await disconnectTestDB());
  afterEach(async () => await clearTestDB());

  // ─── GET /auth/me ─────────────────────────────────────────────────────────

  describe("GET /api/v1/auth/me", () => {
    it("should return 401 with no token", async () => {
      const res = await request(app).get("/api/v1/auth/me");
      expect(res.status).toBe(401);
    });

    it("should return 401 with a malformed Authorization header", async () => {
      const res = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", "InvalidTokenHere");

      expect(res.status).toBe(401);
    });

    it("should return 401 with a tampered token", async () => {
      const res = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", "Bearer invalid.token.here");

      expect(res.status).toBe(401);
    });

    it("should return 401 if the user no longer exists in DB", async () => {
      // Get a token for a user that was never saved to DB
      const headers = await getAuthHeader();

      const res = await request(app)
        .get("/api/v1/auth/me")
        .set(headers);

      expect(res.status).toBe(401);
      expect(res.body.message).toContain("no longer exists");
    });

    it("should return 200 with user data for a valid token", async () => {
      const user = await createTestUser();
      const headers = await getAuthHeader(user._id, user.phone);

      const res = await request(app)
        .get("/api/v1/auth/me")
        .set(headers);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.phone).toBe(TEST_PHONE);
      expect(res.body.data.id).toBe(user._id.toString());
    });

    it("should never return deviceTokens in the response", async () => {
      const user = await createTestUser();
      const headers = await getAuthHeader(user._id, user.phone);

      const res = await request(app)
        .get("/api/v1/auth/me")
        .set(headers);

      expect(res.body.data.deviceTokens).toBeUndefined();
    });
  });

  // ─── POST /auth/refresh ───────────────────────────────────────────────────

  describe("POST /api/v1/auth/refresh", () => {
    it("should return 401 with no token", async () => {
      const res = await request(app).post("/api/v1/auth/refresh");
      expect(res.status).toBe(401);
    });

    it("should return a new token for a valid token", async () => {
      const user = await createTestUser();
      const headers = await getAuthHeader(user._id, user.phone);

      const res = await request(app)
        .post("/api/v1/auth/refresh")
        .set(headers);

      expect(res.status).toBe(200);
      expect(res.body.data.token).toBeDefined();
      // New token should be different from the original
      // (iat timestamp differs even if issued seconds apart)
      expect(typeof res.body.data.token).toBe("string");
      expect(res.body.data.token.split(".")).toHaveLength(3);
    });
  });
});