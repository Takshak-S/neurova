import request from "supertest";
import app from "../../app";
import { connectTestDB, disconnectTestDB, clearTestDB } from "../helpers/testDB";
import "../helpers/redisMock";
import { createTestUser, getAuthHeader, TEST_PHONE } from "../helpers/factories";

jest.mock("../../services/sms.service", () => ({
  smsService: { sendOTP: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock("../../socket/socketManager", () => ({
  socketManager: {
    isOnline: jest.fn().mockReturnValue(false),
    emitToUser: jest.fn().mockReturnValue(false),
    emitToConversation: jest.fn(),
    getOnlineUsers: jest.fn().mockReturnValue([]),
    setIO: jest.fn(),
  },
}));

describe("User REST endpoints", () => {
  beforeAll(async () => await connectTestDB());
  afterAll(async () => await disconnectTestDB());
  afterEach(async () => await clearTestDB());

  // ── GET /users/search ──────────────────────────────────────────────────────

  describe("GET /api/v1/users/search?phone=...", () => {
    it("should return 401 without token", async () => {
      const res = await request(app).get(
        "/api/v1/users/search?phone=+919876543210"
      );
      expect(res.status).toBe(401);
    });

    it("should return 400 if phone query param is missing", async () => {
      const user = await createTestUser();
      const headers = await getAuthHeader(user._id, user.phone);

      const res = await request(app)
        .get("/api/v1/users/search")
        .set(headers);

      expect(res.status).toBe(400);
    });

    it("should return user: null when no user found (not 404)", async () => {
      const user = await createTestUser();
      const headers = await getAuthHeader(user._id, user.phone);

      const res = await request(app)
        .get("/api/v1/users/search?phone=+919000000099")
        .set(headers);

      // Must be 200, not 404 — 404 reveals to an attacker that the number is unregistered
      expect(res.status).toBe(200);
      expect(res.body.data.user).toBeNull();
    });

    it("should return the user when found", async () => {
      const searcher = await createTestUser({ phone: "+919000000001" });
      const target = await createTestUser({
        phone: "+919000000002",
        name: "Target User",
      });
      const headers = await getAuthHeader(searcher._id, searcher.phone);

      const res = await request(app)
        .get(`/api/v1/users/search?phone=${target.phone}`)
        .set(headers);

      expect(res.status).toBe(200);
      expect(res.body.data.user).not.toBeNull();
      expect(res.body.data.user.phone).toBe(target.phone);
    });

    it("should not return sensitive fields in search results", async () => {
      const searcher = await createTestUser({ phone: "+919000000003" });
      const target = await createTestUser({ phone: "+919000000004" });
      const headers = await getAuthHeader(searcher._id, searcher.phone);

      const res = await request(app)
        .get(`/api/v1/users/search?phone=${target.phone}`)
        .set(headers);

      const user = res.body.data.user;
      expect(user.deviceTokens).toBeUndefined();
      expect(user.hashedOTP).toBeUndefined();
    });
  });

  // ── POST /users/me/public-key ──────────────────────────────────────────────

  describe("POST /api/v1/users/me/public-key", () => {
    it("should register a public key for the user", async () => {
      const user = await createTestUser();
      const headers = await getAuthHeader(user._id, user.phone);

      const res = await request(app)
        .post("/api/v1/users/me/public-key")
        .set(headers)
        .send({ publicKey: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA..." });

      expect(res.status).toBe(200);
    });

    it("should return 400 if publicKey is missing", async () => {
      const user = await createTestUser();
      const headers = await getAuthHeader(user._id, user.phone);

      const res = await request(app)
        .post("/api/v1/users/me/public-key")
        .set(headers)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  // ── GET /users/:id/public-key ─────────────────────────────────────────────

  describe("GET /api/v1/users/:id/public-key", () => {
    it("should return 400 if user has no public key set", async () => {
      const requester = await createTestUser({ phone: "+919000000005" });
      const target = await createTestUser({ phone: "+919000000006" }); // no publicKey
      const headers = await getAuthHeader(requester._id, requester.phone);

      const res = await request(app)
        .get(`/api/v1/users/${target._id}/public-key`)
        .set(headers);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("encryption keys");
    });

    it("should return the public key when set", async () => {
      const requester = await createTestUser({ phone: "+919000000007" });
      const target = await createTestUser({
        phone: "+919000000008",
        publicKey: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...",
      });
      const headers = await getAuthHeader(requester._id, requester.phone);

      const res = await request(app)
        .get(`/api/v1/users/${target._id}/public-key`)
        .set(headers);

      expect(res.status).toBe(200);
      expect(res.body.data.publicKey).toBe(target.publicKey);
    });
  });
});