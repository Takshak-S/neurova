import { buildSummarizePrompt } from "../../ai/prompts/summarize.prompt";
import { buildSmartReplyPrompt } from "../../ai/prompts/reply.prompt";
import { buildTasksPrompt } from "../../ai/prompts/tasks.prompt";
import { aiService } from "../../ai/ai.service";
import { getAIProvider, resetAIProvider } from "../../ai/providers";
import { AIMessage } from "../../ai/types";
import { ApiError } from "../../utils/ApiError";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeMessages = (count: number): AIMessage[] =>
  Array.from({ length: count }, (_, i) => ({
    senderId: `user-${i % 2 === 0 ? "a" : "b"}`,
    senderName: i % 2 === 0 ? "Alice" : "Bob",
    content: `Message number ${i + 1}`,
    createdAt: new Date(Date.now() - (count - i) * 60000).toISOString(),
  }));

const singleMessage: AIMessage[] = [{
  senderId: "user-a",
  senderName: "Alice",
  content: "Can you send me the report by Friday?",
  createdAt: new Date().toISOString(),
}];

// ─── Prompt builder tests ─────────────────────────────────────────────────────

describe("buildSummarizePrompt()", () => {
  it("should return a system and user prompt", () => {
    const { system, user } = buildSummarizePrompt(singleMessage);
    expect(system).toBeTruthy();
    expect(user).toBeTruthy();
  });

  it("should include message content in the user prompt", () => {
    const { user } = buildSummarizePrompt(singleMessage);
    expect(user).toContain("Can you send me the report by Friday?");
  });

  it("should include sender names when provided", () => {
    const { user } = buildSummarizePrompt(singleMessage);
    expect(user).toContain("Alice");
  });

  it("should cap messages to the configured maximum", () => {
    // Send 60 messages — should be capped to 50 (AI_MAX_MESSAGES_FOR_SUMMARY)
    const messages = makeMessages(60);
    const { user } = buildSummarizePrompt(messages);

    // The oldest messages (1-10) should not appear, latest 50 should
    expect(user).toContain("Message number 60");
    expect(user).not.toMatch("/Message number 1(?!\d)/");
  });
});

describe("buildSmartReplyPrompt()", () => {
  it("should return a system and user prompt", () => {
    const { system, user } = buildSmartReplyPrompt(singleMessage);
    expect(system).toBeTruthy();
    expect(user).toBeTruthy();
  });

  it("should cap to the last N messages for context", () => {
    const messages = makeMessages(10);
    const { user } = buildSmartReplyPrompt(messages);

    // Only last 5 messages (AI_MAX_MESSAGES_FOR_REPLY) should appear
    expect(user).toContain("Message number 10");
    expect(user).not.toMatch("/Message number 1(?!\d)/");
  });

  it("should include recipient name in the system prompt when provided", () => {
    const { system } = buildSmartReplyPrompt(singleMessage, "Bob");
    expect(system).toContain("Bob");
  });

  it("should instruct JSON array output", () => {
    const { system } = buildSmartReplyPrompt(singleMessage);
    expect(system).toContain("JSON array");
  });
});

describe("buildTasksPrompt()", () => {
  it("should return a system and user prompt", () => {
    const { system, user } = buildTasksPrompt(singleMessage);
    expect(system).toBeTruthy();
    expect(user).toBeTruthy();
  });

  it("should include all messages (no cap — tasks can appear anywhere)", () => {
    const messages = makeMessages(60);
    const { user } = buildTasksPrompt(messages);
    // Task prompts use the full message set
    expect(user).toContain("Message number 1");
    expect(user).toContain("Message number 60");
  });

  it("should instruct empty array for no tasks found", () => {
    const { system } = buildTasksPrompt(singleMessage);
    expect(system).toContain("[]");
  });
});

// ─── aiService unit tests (provider mocked) ───────────────────────────────────

jest.mock("../../ai/providers");

const mockGetAIProvider = getAIProvider as jest.MockedFunction<typeof getAIProvider>;

describe("aiService.process()", () => {
  const mockProvider = {
    complete: jest.fn(),
    isAvailable: jest.fn().mockResolvedValue(true),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAIProvider.mockReturnValue(mockProvider as any);
  });

  it("should throw 400 if messages array is empty", async () => {
    await expect(
      aiService.process({
        feature: "summarize",
        messages: [],
        conversationId: "64abc1234567890123456789",
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("should throw 400 for an unknown feature", async () => {
    await expect(
      aiService.process({
        feature: "unknown" as any,
        messages: singleMessage,
        conversationId: "64abc1234567890123456789",
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  describe("summarize", () => {
    it("should return a summarize response with the AI result", async () => {
      mockProvider.complete.mockResolvedValue("Alice and Bob discussed the report deadline.");

      const result = await aiService.process({
        feature: "summarize",
        messages: singleMessage,
        conversationId: "64abc1234567890123456789",
      });

      expect(result.feature).toBe("summarize");
      expect((result as any).result).toContain("Alice and Bob");
    });

    it("should throw 500 if AI returns an empty string", async () => {
      mockProvider.complete.mockResolvedValue("");

      await expect(
        aiService.process({
          feature: "summarize",
          messages: singleMessage,
          conversationId: "64abc1234567890123456789",
        })
      ).rejects.toMatchObject({ statusCode: 500 });
    });
  });

  describe("reply", () => {
    it("should return exactly 3 reply suggestions", async () => {
      mockProvider.complete.mockResolvedValue(
        '["Sure!", "Sounds good", "I\'ll get it done"]'
      );

      const result = await aiService.process({
        feature: "reply",
        messages: singleMessage,
        conversationId: "64abc1234567890123456789",
      });

      expect(result.feature).toBe("reply");
      expect((result as any).result).toHaveLength(3);
    });

    it("should strip markdown code fences from AI output", async () => {
      mockProvider.complete.mockResolvedValue(
        '```json\n["Sure!", "Sounds good", "Will do"]\n```'
      );

      const result = await aiService.process({
        feature: "reply",
        messages: singleMessage,
        conversationId: "64abc1234567890123456789",
      });

      expect((result as any).result).toHaveLength(3);
    });

    it("should throw 500 if AI returns fewer than 3 suggestions", async () => {
      mockProvider.complete.mockResolvedValue('["Just one reply"]');

      await expect(
        aiService.process({
          feature: "reply",
          messages: singleMessage,
          conversationId: "64abc1234567890123456789",
        })
      ).rejects.toMatchObject({ statusCode: 500 });
    });

    it("should throw 500 if AI returns invalid JSON", async () => {
      mockProvider.complete.mockResolvedValue("not json at all");

      await expect(
        aiService.process({
          feature: "reply",
          messages: singleMessage,
          conversationId: "64abc1234567890123456789",
        })
      ).rejects.toMatchObject({ statusCode: 500 });
    });
  });

  describe("tasks", () => {
    it("should return extracted tasks as an array", async () => {
      mockProvider.complete.mockResolvedValue(
        '["Alice: Send report by Friday", "Bob: Book meeting room"]'
      );

      const result = await aiService.process({
        feature: "tasks",
        messages: singleMessage,
        conversationId: "64abc1234567890123456789",
      });

      expect(result.feature).toBe("tasks");
      expect((result as any).result).toHaveLength(2);
    });

    it("should return an empty array when no tasks found", async () => {
      mockProvider.complete.mockResolvedValue("[]");

      const result = await aiService.process({
        feature: "tasks",
        messages: singleMessage,
        conversationId: "64abc1234567890123456789",
      });

      expect((result as any).result).toHaveLength(0);
    });

    it("should throw 500 if AI returns invalid JSON for tasks", async () => {
      mockProvider.complete.mockResolvedValue("No tasks found in this conversation.");

      await expect(
        aiService.process({
          feature: "tasks",
          messages: singleMessage,
          conversationId: "64abc1234567890123456789",
        })
      ).rejects.toMatchObject({ statusCode: 500 });
    });
  });
});