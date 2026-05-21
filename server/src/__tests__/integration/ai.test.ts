import request from "supertest";
import app from "../../app";
import { connectTestDB, disconnectTestDB, clearTestDB } from "../helpers/testDB";
import "../helpers/redisMock";
import { createTestUser, getAuthHeader } from "../helpers/factories";

jest.mock("../../services/sms.service", () => ({
  smsService: { sendOTP: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock("../../socket/socketManager", () => ({
  socketManager: {
    isOnline: jest.fn().mockReturnValue(false),
    emitToUser: jest.fn(),
    emitToConversation: jest.fn(),
    getOnlineUsers: jest.fn().mockReturnValue([]),
    setIO: jest.fn(),
  },
}));

// Mock the AI provider — we never call real Groq/Ollama in tests.
// This keeps tests fast, free, and deterministic.
// We test the full HTTP → controller → service → prompt pipeline,
// but stub out the actual LLM call.
jest.mock("../../ai/providers", () => ({
  getAIProvider: jest.fn(),
  resetAIProvider: jest.fn(),
}));

import { getAIProvider } from "../../ai/providers";

const mockGetAIProvider = getAIProvider as jest.MockedFunction<typeof getAIProvider>;

const mockProvider = {
  complete: jest.fn(),
  isAvailable: jest.fn().mockResolvedValue(true),
};

const VALID_CONVERSATION_ID = "64abc1234567890123456789";

const VALID_MESSAGES = [
  {
    senderId: "64abc1234567890123456780",
    senderName: "Alice",
    content: "Can you send me the report by Friday?",
    createdAt: new Date().toISOString(),
  },
  {
    senderId: "64abc1234567890123456781",
    senderName: "Bob",
    content: "Sure, I'll get it done by Thursday to be safe.",
    createdAt: new Date().toISOString(),
  },
];

describe("AI endpoints", () => {
  beforeAll(async () => await connectTestDB());
  afterAll(async () => await disconnectTestDB());
  afterEach(async () => {
    await clearTestDB();
    jest.clearAllMocks();
  });

  beforeEach(() => {
    mockGetAIProvider.mockReturnValue(mockProvider as any);
  });

  // ── Authentication ──────────────────────────────────────────────────────────

  describe("authentication", () => {
    it("should return 401 without a token", async () => {
      const res = await request(app)
        .post("/api/v1/ai/process")
        .send({ feature: "summarize", messages: VALID_MESSAGES, conversationId: VALID_CONVERSATION_ID });

      expect(res.status).toBe(401);
    });
  });

  // ── Input validation ────────────────────────────────────────────────────────

  describe("POST /api/v1/ai/process — validation", () => {
    let headers: Record<string, string>;

    beforeEach(async () => {
      const user = await createTestUser();
      headers = await getAuthHeader(user._id, user.phone);
    });

    it("should return 400 if feature is missing", async () => {
      const res = await request(app)
        .post("/api/v1/ai/process")
        .set(headers)
        .send({ messages: VALID_MESSAGES, conversationId: VALID_CONVERSATION_ID });

      expect(res.status).toBe(400);
    });

    it("should return 400 for an invalid feature value", async () => {
      const res = await request(app)
        .post("/api/v1/ai/process")
        .set(headers)
        .send({ feature: "magic", messages: VALID_MESSAGES, conversationId: VALID_CONVERSATION_ID });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Invalid feature");
    });

    it("should return 400 if messages array is empty", async () => {
      const res = await request(app)
        .post("/api/v1/ai/process")
        .set(headers)
        .send({ feature: "summarize", messages: [], conversationId: VALID_CONVERSATION_ID });

      expect(res.status).toBe(400);
    });

    it("should return 400 if conversationId is not a valid ObjectId", async () => {
      const res = await request(app)
        .post("/api/v1/ai/process")
        .set(headers)
        .send({ feature: "summarize", messages: VALID_MESSAGES, conversationId: "not-an-id" });

      expect(res.status).toBe(400);
    });

    it("should return 400 if a message is missing content", async () => {
      const res = await request(app)
        .post("/api/v1/ai/process")
        .set(headers)
        .send({
          feature: "summarize",
          conversationId: VALID_CONVERSATION_ID,
          messages: [{ senderId: "abc", createdAt: new Date().toISOString() }],
        });

      expect(res.status).toBe(400);
    });

    it("should return 400 if messages array exceeds 100 items", async () => {
      const tooMany = Array.from({ length: 101 }, (_, i) => ({
        senderId: "user-a",
        content: `Message ${i}`,
        createdAt: new Date().toISOString(),
      }));

      const res = await request(app)
        .post("/api/v1/ai/process")
        .set(headers)
        .send({ feature: "summarize", messages: tooMany, conversationId: VALID_CONVERSATION_ID });

      expect(res.status).toBe(400);
    });
  });

  // ── Summarize ───────────────────────────────────────────────────────────────

  describe("POST /api/v1/ai/process — summarize", () => {
    let headers: Record<string, string>;

    beforeEach(async () => {
      const user = await createTestUser();
      headers = await getAuthHeader(user._id, user.phone);
    });

    it("should return 200 with a summary string", async () => {
      mockProvider.complete.mockResolvedValue(
        "Alice asked Bob to send a report by Friday. Bob agreed to have it ready by Thursday."
      );

      const res = await request(app)
        .post("/api/v1/ai/process")
        .set(headers)
        .send({ feature: "summarize", messages: VALID_MESSAGES, conversationId: VALID_CONVERSATION_ID });

      expect(res.status).toBe(200);
      expect(res.body.data.feature).toBe("summarize");
      expect(typeof res.body.data.result).toBe("string");
      expect(res.body.data.result.length).toBeGreaterThan(0);
    });

    it("should return 500 if AI returns an empty response", async () => {
      mockProvider.complete.mockResolvedValue("   ");

      const res = await request(app)
        .post("/api/v1/ai/process")
        .set(headers)
        .send({ feature: "summarize", messages: VALID_MESSAGES, conversationId: VALID_CONVERSATION_ID });

      expect(res.status).toBe(500);
    });
  });

  // ── Smart Reply ─────────────────────────────────────────────────────────────

  describe("POST /api/v1/ai/process — reply", () => {
    let headers: Record<string, string>;

    beforeEach(async () => {
      const user = await createTestUser();
      headers = await getAuthHeader(user._id, user.phone);
    });

    it("should return 200 with exactly 3 reply suggestions", async () => {
      mockProvider.complete.mockResolvedValue(
        '["Thanks!", "I\'ll check right away", "Can you resend it?"]'
      );

      const res = await request(app)
        .post("/api/v1/ai/process")
        .set(headers)
        .send({ feature: "reply", messages: VALID_MESSAGES, conversationId: VALID_CONVERSATION_ID });

      expect(res.status).toBe(200);
      expect(res.body.data.feature).toBe("reply");
      expect(res.body.data.result).toHaveLength(3);
      expect(typeof res.body.data.result[0]).toBe("string");
    });

    it("should handle markdown-wrapped JSON from the AI", async () => {
      mockProvider.complete.mockResolvedValue(
        "```json\n[\"Sure!\", \"Sounds good\", \"Will do\"]\n```"
      );

      const res = await request(app)
        .post("/api/v1/ai/process")
        .set(headers)
        .send({ feature: "reply", messages: VALID_MESSAGES, conversationId: VALID_CONVERSATION_ID });

      expect(res.status).toBe(200);
      expect(res.body.data.result).toHaveLength(3);
    });
  });

  // ── Task extraction ─────────────────────────────────────────────────────────

  describe("POST /api/v1/ai/process — tasks", () => {
    let headers: Record<string, string>;

    beforeEach(async () => {
      const user = await createTestUser();
      headers = await getAuthHeader(user._id, user.phone);
    });

    it("should return 200 with extracted tasks", async () => {
      mockProvider.complete.mockResolvedValue(
        '["Bob: Send report to Alice by Friday"]'
      );

      const res = await request(app)
        .post("/api/v1/ai/process")
        .set(headers)
        .send({ feature: "tasks", messages: VALID_MESSAGES, conversationId: VALID_CONVERSATION_ID });

      expect(res.status).toBe(200);
      expect(res.body.data.feature).toBe("tasks");
      expect(res.body.data.result).toHaveLength(1);
    });

    it("should return 200 with empty array when no tasks found", async () => {
      mockProvider.complete.mockResolvedValue("[]");

      const res = await request(app)
        .post("/api/v1/ai/process")
        .set(headers)
        .send({ feature: "tasks", messages: VALID_MESSAGES, conversationId: VALID_CONVERSATION_ID });

      expect(res.status).toBe(200);
      expect(res.body.data.result).toHaveLength(0);
    });
  });

  // ── Rate limiting ───────────────────────────────────────────────────────────

  describe("AI rate limiting", () => {
    it("should return 429 after exceeding 20 requests per hour", async () => {
      const user = await createTestUser({ phone: "+919555000001" });
      const headers = await getAuthHeader(user._id, user.phone);

      mockProvider.complete.mockResolvedValue(
        "Alice and Bob discussed a deadline."
      );

      // Make 20 requests — the limit
      for (let i = 0; i < 20; i++) {
        await request(app)
          .post("/api/v1/ai/process")
          .set(headers)
          .send({ feature: "summarize", messages: VALID_MESSAGES, conversationId: VALID_CONVERSATION_ID });
      }

      // 21st should be blocked
      const res = await request(app)
        .post("/api/v1/ai/process")
        .set(headers)
        .send({ feature: "summarize", messages: VALID_MESSAGES, conversationId: VALID_CONVERSATION_ID });

      expect(res.status).toBe(429);
      expect(res.body.message).toContain("rate limit");
    });

    it("should include rate limit headers in every AI response", async () => {
      const user = await createTestUser({ phone: "+919555000002" });
      const headers = await getAuthHeader(user._id, user.phone);

      mockProvider.complete.mockResolvedValue("A summary.");

      const res = await request(app)
        .post("/api/v1/ai/process")
        .set(headers)
        .send({ feature: "summarize", messages: VALID_MESSAGES, conversationId: VALID_CONVERSATION_ID });

      expect(res.headers["x-ai-ratelimit-limit"]).toBeDefined();
      expect(res.headers["x-ai-ratelimit-remaining"]).toBeDefined();
    });
  });

  // ── Health check ────────────────────────────────────────────────────────────

  describe("GET /api/v1/ai/health", () => {
    it("should return 200 when provider is available", async () => {
      const user = await createTestUser({ phone: "+919555000003" });
      const headers = await getAuthHeader(user._id, user.phone);

      mockProvider.isAvailable.mockResolvedValue(true);

      const res = await request(app)
        .get("/api/v1/ai/health")
        .set(headers);

      expect(res.status).toBe(200);
      expect(res.body.data.available).toBe(true);
    });

    it("should return 503 when provider is unavailable", async () => {
      const user = await createTestUser({ phone: "+919555000004" });
      const headers = await getAuthHeader(user._id, user.phone);

      mockProvider.isAvailable.mockResolvedValue(false);

      const res = await request(app)
        .get("/api/v1/ai/health")
        .set(headers);

      expect(res.status).toBe(503);
      expect(res.body.data.available).toBe(false);
    });
  });
});