import { AIRequest, AIResponse, AIMessage } from "./types";
import { getAIProvider } from "./providers";
import { buildSummarizePrompt } from "./prompts/summarize.prompt";
import { buildSmartReplyPrompt } from "./prompts/reply.prompt";
import { buildTasksPrompt } from "./prompts/tasks.prompt";
import { ApiError } from "../utils/ApiError";

// The AI service is the only place in the codebase that knows about:
// - which feature maps to which prompt
// - how to parse and validate the raw LLM string output
// - what constitutes a valid vs invalid AI response
//
// Controllers call process() and get back a typed AIResponse.
// They never touch providers or prompts directly.

export const aiService = {
  async process(request: AIRequest): Promise<AIResponse> {
    const { feature, messages } = request;

    // Gate: refuse to process if no messages were provided.
    // The client should never send empty messages, but we validate defensively.
    if (!messages || messages.length === 0) {
      throw ApiError.badRequest("At least one message is required for AI processing");
    }

    const provider = getAIProvider();

    switch (feature) {
      case "summarize":
        return aiService.summarize(messages, provider);
      case "reply":
        return aiService.smartReply(messages, provider);
      case "tasks":
        return aiService.extractTasks(messages, provider);
      default:
        throw ApiError.badRequest(
          `Unknown feature: "${feature}". Valid options: summarize, reply, tasks`
        );
    }
  },

  async summarize(
    messages: AIMessage[],
    provider: ReturnType<typeof getAIProvider>
  ): Promise<AIResponse> {
    const { system, user } = buildSummarizePrompt(messages);
    const raw = await provider.complete(system, user);

    // Summarize returns freeform prose — no parsing needed.
    // Just sanitize whitespace and enforce a minimum length check.
    const result = raw.trim();
    if (result.length < 10) {
      throw ApiError.internal("AI returned an unusably short summary");
    }

    return { feature: "summarize", result };
  },

  async smartReply(
    messages: AIMessage[],
    provider: ReturnType<typeof getAIProvider>
  ): Promise<AIResponse> {
    const lastMessage = messages[messages.length - 1];
    const { system, user } = buildSmartReplyPrompt(
      messages,
      lastMessage?.senderName
    );

    const raw = await provider.complete(system, user);
    const replies = parseJSONArray(raw, "smart replies");

    // Validate: must be exactly 3 strings
    if (replies.length !== 3) {
      throw ApiError.internal(
        `AI returned ${replies.length} reply suggestions, expected 3`
      );
    }

    // Validate: each reply must be a non-empty string
    for (const reply of replies) {
      if (typeof reply !== "string" || reply.trim().length === 0) {
        throw ApiError.internal("AI returned invalid reply suggestions");
      }
    }

    return { feature: "reply", result: replies.map((r: string) => r.trim()) };
  },

  async extractTasks(
    messages: AIMessage[],
    provider: ReturnType<typeof getAIProvider>
  ): Promise<AIResponse> {
    const { system, user } = buildTasksPrompt(messages);
    const raw = await provider.complete(system, user);
    const tasks = parseJSONArray(raw, "tasks");

    // Empty array is valid — "no tasks found" is a legitimate result
    // Validate: each task must be a non-empty string
    for (const task of tasks) {
      if (typeof task !== "string" || task.trim().length === 0) {
        throw ApiError.internal("AI returned an invalid task item");
      }
    }

    return { feature: "tasks", result: tasks.map((t: string) => t.trim()) };
  },

  // Health check — used by /ai/health to verify the provider is reachable
  async checkHealth(): Promise<{
    provider: string;
    model: string;
    available: boolean;
  }> {
    const { env } = await import("../config/env");
    const provider = getAIProvider();
    const available = await provider.isAvailable();

    return {
      provider: env.ai.provider,
      model:
        env.ai.provider === "groq"
          ? env.ai.groq.model
          : env.ai.ollama.model,
      available,
    };
  },
};

// ─── Parsing utilities ────────────────────────────────────────────────────────

// LLMs sometimes wrap JSON in markdown code fences (```json ... ```)
// even when instructed not to. This strips them before parsing.
// If the model returns valid JSON without fences, this is a no-op.
function stripMarkdownCodeFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
}

// Parses a JSON array from raw LLM output.
// Throws a descriptive ApiError if parsing fails — not a generic 500.
function parseJSONArray(raw: string, context: string): string[] {
  const cleaned = stripMarkdownCodeFences(raw);

  try {
    const parsed = JSON.parse(cleaned);

    if (!Array.isArray(parsed)) {
      throw new Error(`Expected array, got ${typeof parsed}`);
    }

    return parsed;
  } catch (error) {
    // Log the raw output for debugging — never expose it to the client
    console.error(`[AI] Failed to parse ${context}. Raw output:`, raw);
    throw ApiError.internal(
      `AI returned malformed ${context}. Please try again.`
    );
  }
}