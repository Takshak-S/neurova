import request from "supertest";
import app from "../../app";
import { connectTestDB, disconnectTestDB, clearTestDB } from "../helpers/testDB";
import "../helpers/redisMock";
import { createTestUser, getAuthHeader } from "../helpers/factories";
import ConversationModel from "../../models/Conversation.model";
import { Types } from "mongoose";

jest.mock("../../services/sms.service", () => ({
  smsService: { sendOTP: jest.fn().mockResolvedValue(undefined) },
}));

// Mock socketManager so no real Socket.IO server is needed in tests
jest.mock("../../socket/socketManager", () => ({
  socketManager: {
    isOnline: jest.fn().mockReturnValue(false),
    emitToUser: jest.fn().mockReturnValue(false),
    emitToConversation: jest.fn(),
    getOnlineUsers: jest.fn().mockReturnValue([]),
    setIO: jest.fn(),
  },
}));

describe("Conversation REST endpoints", () => {
  beforeAll(async () => await connectTestDB());
  afterAll(async () => await disconnectTestDB());
  afterEach(async () => await clearTestDB());

  // ── POST /conversations ───────────────────────────────────────────────────

  describe("POST /api/v1/conversations", () => {
    it("should return 401 without a token", async () => {
      const res = await request(app)
        .post("/api/v1/conversations")
        .send({ targetUserId: new Types.ObjectId().toString() });

      expect(res.status).toBe(401);
    });

    it("should return 400 if targetUserId is missing", async () => {
      const user = await createTestUser();
      const headers = await getAuthHeader(user._id, user.phone);

      const res = await request(app)
        .post("/api/v1/conversations")
        .set(headers)
        .send({});

      expect(res.status).toBe(400);
    });

    it("should return 400 if targetUserId is not a valid ObjectId", async () => {
      const user = await createTestUser();
      const headers = await getAuthHeader(user._id, user.phone);

      const res = await request(app)
        .post("/api/v1/conversations")
        .set(headers)
        .send({ targetUserId: "not-an-objectid" });

      expect(res.status).toBe(400);
    });

    it("should create a pending conversation and return 201", async () => {
      const userA = await createTestUser({ phone: "+919000000001" });
      const userB = await createTestUser({ phone: "+919000000002" });
      const headers = await getAuthHeader(userA._id, userA.phone);

      const res = await request(app)
        .post("/api/v1/conversations")
        .set(headers)
        .send({ targetUserId: userB._id.toString() });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("pending");
    });

    it("should return 200 (not 201) for an existing conversation", async () => {
      const userA = await createTestUser({ phone: "+919000000003" });
      const userB = await createTestUser({ phone: "+919000000004" });
      const headers = await getAuthHeader(userA._id, userA.phone);

      // Create once
      await request(app)
        .post("/api/v1/conversations")
        .set(headers)
        .send({ targetUserId: userB._id.toString() });

      // Create again — same pair
      const res = await request(app)
        .post("/api/v1/conversations")
        .set(headers)
        .send({ targetUserId: userB._id.toString() });

      expect(res.status).toBe(200);

      // Only one conversation document should exist
      const count = await ConversationModel.countDocuments();
      expect(count).toBe(1);
    });
  });

  // ── GET /conversations ────────────────────────────────────────────────────

  describe("GET /api/v1/conversations", () => {
    it("should return empty array when user has no conversations", async () => {
      const user = await createTestUser();
      const headers = await getAuthHeader(user._id, user.phone);

      const res = await request(app)
        .get("/api/v1/conversations")
        .set(headers);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it("should return conversations for the authenticated user", async () => {
      const userA = await createTestUser({ phone: "+919000000005" });
      const userB = await createTestUser({ phone: "+919000000006" });

      await ConversationModel.create({
        members: [userA._id, userB._id].sort(),
        type: "direct",
        status: "accepted",
        requestedBy: userA._id,
      });

      const headers = await getAuthHeader(userA._id, userA.phone);
      const res = await request(app)
        .get("/api/v1/conversations")
        .set(headers);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it("should not include rejected conversations", async () => {
      const userA = await createTestUser({ phone: "+919000000007" });
      const userB = await createTestUser({ phone: "+919000000008" });

      await ConversationModel.create({
        members: [userA._id, userB._id].sort(),
        type: "direct",
        status: "rejected",
        requestedBy: userA._id,
      });

      const headers = await getAuthHeader(userA._id, userA.phone);
      const res = await request(app)
        .get("/api/v1/conversations")
        .set(headers);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });
  });

  // ── PATCH /conversations/:id/accept ──────────────────────────────────────

  describe("PATCH /api/v1/conversations/:id/accept", () => {
    it("should allow the recipient to accept a pending request", async () => {
      const requester = await createTestUser({ phone: "+919000000009" });
      const recipient = await createTestUser({ phone: "+919000000010" });

      const conv = await ConversationModel.create({
        members: [requester._id, recipient._id].sort(),
        type: "direct",
        status: "pending",
        requestedBy: requester._id,
      });

      const headers = await getAuthHeader(recipient._id, recipient.phone);
      const res = await request(app)
        .patch(`/api/v1/conversations/${conv._id}/accept`)
        .set(headers);

      expect(res.status).toBe(200);

      const updated = await ConversationModel.findById(conv._id);
      expect(updated!.status).toBe("accepted");
    });

    it("should return 404 if the requester tries to accept their own request", async () => {
      const requester = await createTestUser({ phone: "+919000000011" });
      const recipient = await createTestUser({ phone: "+919000000012" });

      const conv = await ConversationModel.create({
        members: [requester._id, recipient._id].sort(),
        type: "direct",
        status: "pending",
        requestedBy: requester._id,
      });

      // Requester tries to accept — should fail
      const headers = await getAuthHeader(requester._id, requester.phone);
      const res = await request(app)
        .patch(`/api/v1/conversations/${conv._id}/accept`)
        .set(headers);

      expect(res.status).toBe(404);
    });
  });

  // ── PATCH /conversations/:id/reject ──────────────────────────────────────

  describe("PATCH /api/v1/conversations/:id/reject", () => {
    it("should allow the recipient to reject a pending request", async () => {
      const requester = await createTestUser({ phone: "+919000000013" });
      const recipient = await createTestUser({ phone: "+919000000014" });

      const conv = await ConversationModel.create({
        members: [requester._id, recipient._id].sort(),
        type: "direct",
        status: "pending",
        requestedBy: requester._id,
      });

      const headers = await getAuthHeader(recipient._id, recipient.phone);
      const res = await request(app)
        .patch(`/api/v1/conversations/${conv._id}/reject`)
        .set(headers);

      expect(res.status).toBe(200);

      const updated = await ConversationModel.findById(conv._id);
      expect(updated!.status).toBe("rejected");
    });
  });
});