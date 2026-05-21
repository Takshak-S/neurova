import { AIProvider } from "../types";
import { env } from "../../config/env";
import { ApiError } from "../../utils/ApiError";

// Groq runs open-source models (Llama 3.1) on their own hardware.
// Free tier: ~14,000 requests/day, sub-second response times.
// We call the REST API directly — no SDK dependency needed.
// This keeps the bundle small and avoids SDK version conflicts.

export class GroqProvider implements AIProvider {
  private readonly baseUrl = "https://api.groq.com/openai/v1";
  private readonly apiKey: string;
  private readonly model: string;

  constructor() {
    this.apiKey = env.ai.groq.apiKey;
    this.model = env.ai.groq.model;
  }

  async complete(systemPrompt: string, userPrompt: string): Promise<string> {
    if (!this.apiKey) {
      throw ApiError.internal(
        "GROQ_API_KEY is not configured. Set it in your .env file."
      );
    }

    // AbortController gives us a hard timeout on the fetch call.
    // Without this, a slow Groq response could hang the request indefinitely.
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      env.ai.timeoutMs
    );

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: env.ai.maxTokens,
          // temperature: 0.3 keeps responses focused and deterministic.
          // Higher temperature = more creative but less reliable JSON output.
          // For task extraction and smart replies, consistency beats creativity.
          temperature: 0.3,
          // stream: false — we wait for the full response.
          // Streaming would be better UX but adds complexity to the client.
          // Add streaming in a later iteration when the frontend is ready.
          stream: false,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));

        // Groq rate limit — free tier has per-minute limits
        if (response.status === 429) {
          throw ApiError.tooManyRequests(
            "AI service is temporarily rate limited. Please try again in a moment."
          );
        }

        throw ApiError.internal(
          `Groq API error: ${response.status} — ${(errorBody as any)?.error?.message ?? "Unknown error"}`
        );
      }

      const data = await response.json() as {
        choices: Array<{ message: { content: string } }>;
      };

      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw ApiError.internal("Groq returned an empty response");
      }

      return content.trim();
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        throw ApiError.internal(
          `AI request timed out after ${env.ai.timeoutMs / 1000}s`
        );
      }
      // Re-throw ApiErrors as-is — they already have the right status code
      if (error instanceof ApiError) throw error;
      throw ApiError.internal(`Groq request failed: ${(error as Error).message}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  // Health check — called on startup and by the /ai/health endpoint.
  // Groq's models endpoint is lightweight and doesn't consume quota.
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}