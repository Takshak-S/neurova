import request from "supertest";
import app from "../../app";
import { connectTestDB, disconnectTestDB, clearTestDB } from "../helpers/testDB";
import "../helpers/redisMock";
import { createTestUser, getAuthHeader } from "../helpers/factories";
import ConversationModel from "../../models/Conversation.model";
import MessageModel from "../../models/MessageSchema";
import { Types } from "mongoose";

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

// Helper: seed N messages in a conversation
const seedMessages = async (
  conversationId: Types.ObjectId,
  senderId: Types.ObjectId,
  count: number
) => {
  const messages = Array.from({ length: count }, (_, i) => ({
    conversationId,
    senderId,
    encryptedText: `encrypted_message_${i}`,
    iv: `iv_${i}`,
    type: "text",
    status: "sent",
  }));
  return MessageModel.insertMany(messages);
};

describe("Message REST endpoints", () => {
  beforeAll(async () => await connectTestDB());
  afterAll(async () => await disconnectTestDB());
  afterEach(async () => await clearTestDB());

  let userA: any;
  let userB: any;
  let conversation: any;

  beforeEach(async () => {
    userA = await createTestUser({ phone: "+919111000001" });
    userB = await createTestUser({ phone: "+919111000002" });

    conversation = await ConversationModel.create({
      members: [userA._id, userB._id].sort(),
      type: "direct",
      status: "accepted",
      requestedBy: userA._id,
    });
  });

  // ── GET /messages/:conversationId ─────────────────────────────────────────

  describe("GET /api/v1/messages/:conversationId", () => {
    it("should return 401 without token", async () => {
      const res = await request(app).get(
        `/api/v1/messages/${conversation._id}`
      );
      expect(res.status).toBe(401);
    });

    it("should return 404 for a conversation the user is not a member of", async () => {
      const stranger = await createTestUser({ phone: "+919111000003" });
      const headers = await getAuthHeader(stranger._id, stranger.phone);

      const res = await request(app)
        .get(`/api/v1/messages/${conversation._id}`)
        .set(headers);

      expect(res.status).toBe(404);
    });

    it("should return an empty messages array when no messages exist", async () => {
      const headers = await getAuthHeader(userA._id, userA.phone);

      const res = await request(app)
        .get(`/api/v1/messages/${conversation._id}`)
        .set(headers);

      expect(res.status).toBe(200);
      expect(res.body.data.messages).toEqual([]);
      expect(res.body.data.hasMore).toBe(false);
      expect(res.body.data.nextCursor).toBeNull();
    });

    it("should return up to 30 messages per page", async () => {
      await seedMessages(conversation._id, userB._id, 35);
      const headers = await getAuthHeader(userA._id, userA.phone);

      const res = await request(app)
        .get(`/api/v1/messages/${conversation._id}`)
        .set(headers);

      expect(res.status).toBe(200);
      expect(res.body.data.messages).toHaveLength(30);
      expect(res.body.data.hasMore).toBe(true);
      expect(res.body.data.nextCursor).not.toBeNull();
    });

    it("should return hasMore: false when there are <= 30 messages", async () => {
      await seedMessages(conversation._id, userB._id, 10);
      const headers = await getAuthHeader(userA._id, userA.phone);

      const res = await request(app)
        .get(`/api/v1/messages/${conversation._id}`)
        .set(headers);

      expect(res.body.data.hasMore).toBe(false);
      expect(res.body.data.nextCursor).toBeNull();
    });

    it("should paginate correctly using the cursor", async () => {
      await seedMessages(conversation._id, userB._id, 35);
      const headers = await getAuthHeader(userA._id, userA.phone);

      // First page
      const page1 = await request(app)
        .get(`/api/v1/messages/${conversation._id}`)
        .set(headers);

      const cursor = page1.body.data.nextCursor;
      expect(cursor).not.toBeNull();

      // Second page using cursor
      const page2 = await request(app)
        .get(`/api/v1/messages/${conversation._id}?before=${cursor}`)
        .set(headers);

      expect(page2.status).toBe(200);
      expect(page2.body.data.messages).toHaveLength(5); // 35 - 30 = 5 remaining
      expect(page2.body.data.hasMore).toBe(false);

      // Ensure no overlap between pages
      const page1Ids = page1.body.data.messages.map((m: any) => m._id);
      const page2Ids = page2.body.data.messages.map((m: any) => m._id);
      const overlap = page1Ids.filter((id: string) => page2Ids.includes(id));
      expect(overlap).toHaveLength(0);
    });

    it("should return 400 for an invalid cursor", async () => {
      const headers = await getAuthHeader(userA._id, userA.phone);

      const res = await request(app)
        .get(`/api/v1/messages/${conversation._id}?before=not-a-valid-id`)
        .set(headers);

      expect(res.status).toBe(400);
    });
  });

  // ── POST /messages/:conversationId/read ───────────────────────────────────

  describe("POST /api/v1/messages/:conversationId/read", () => {
    it("should mark unread messages as read", async () => {
      // userB sent 3 messages that userA hasn't read
      await seedMessages(conversation._id, userB._id, 3);

      const headers = await getAuthHeader(userA._id, userA.phone);
      const res = await request(app)
        .post(`/api/v1/messages/${conversation._id}/read`)
        .set(headers);

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(3);

      // All messages should now have userA in readBy
      const messages = await MessageModel.find({ conversationId: conversation._id });
      for (const msg of messages) {
        const readByUser = msg.readBy.some(
          (r) => r.userId.toString() === userA._id.toString()
        );
        expect(readByUser).toBe(true);
      }
    });

    it("should not mark the sender's own messages as read", async () => {
      // userA sent messages — they shouldn't be marked as read by userA
      await seedMessages(conversation._id, userA._id, 2);

      const headers = await getAuthHeader(userA._id, userA.phone);
      const res = await request(app)
        .post(`/api/v1/messages/${conversation._id}/read`)
        .set(headers);

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(0); // nothing to mark
    });

    it("should be idempotent — calling twice does not double-insert readBy", async () => {
      await seedMessages(conversation._id, userB._id, 1);

      const headers = await getAuthHeader(userA._id, userA.phone);

      await request(app)
        .post(`/api/v1/messages/${conversation._id}/read`)
        .set(headers);

      await request(app)
        .post(`/api/v1/messages/${conversation._id}/read`)
        .set(headers);

      const message = await MessageModel.findOne({ conversationId: conversation._id });
      const readByUserA = message!.readBy.filter(
        (r) => r.userId.toString() === userA._id.toString()
      );
      // Should appear exactly once, not twice
      expect(readByUserA).toHaveLength(1);
    });
  });
});