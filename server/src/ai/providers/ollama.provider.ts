import { AIProvider } from "../types";
import { env } from "../../config/env";
import { ApiError } from "../../utils/ApiError";

// Ollama runs models locally on your machine.
// Zero cost, zero network, works offline — ideal for development.
// Install: https://ollama.ai
// Pull the model: ollama pull llama3.1
// Start: ollama serve (runs on port 11434 by default)
//
// In production, swap AI_PROVIDER=groq in your .env.
// The rest of the codebase doesn't change.

export class OllamaProvider implements AIProvider {
  private readonly baseUrl: string;
  private readonly model: string;

  constructor() {
    this.baseUrl = env.ai.ollama.baseUrl;
    this.model = env.ai.ollama.model;
  }

  async complete(systemPrompt: string, userPrompt: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      env.ai.timeoutMs
    );

    try {
      // Ollama's API is OpenAI-compatible — same shape as Groq.
      // This is intentional: if we ever add a third provider, the pattern is identical.
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          stream: false,
          options: {
            temperature: 0.3,
            num_predict: env.ai.maxTokens,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        // Common case: Ollama isn't running
        if (response.status === 0 || !response.ok) {
          throw ApiError.internal(
            "Ollama is not running. Start it with: ollama serve"
          );
        }
        throw ApiError.internal(`Ollama error: ${response.status}`);
      }

      const data = await response.json() as {
        message: { content: string };
      };

      const content = data.message?.content;
      if (!content) {
        throw ApiError.internal("Ollama returned an empty response");
      }

      return content.trim();
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        throw ApiError.internal(
          `Ollama request timed out after ${env.ai.timeoutMs / 1000}s. ` +
          `Is the model loaded? Run: ollama pull ${this.model}`
        );
      }

      // Connection refused = Ollama not running
      if ((error as NodeJS.ErrnoException).code === "ECONNREFUSED") {
        throw ApiError.internal(
          `Cannot connect to Ollama at ${this.baseUrl}. ` +
          "Start it with: ollama serve"
        );
      }

      if (error instanceof ApiError) throw error;
      throw ApiError.internal(`Ollama request failed: ${(error as Error).message}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  // Checks if Ollama is running and the configured model is available
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });

      if (!response.ok) return false;

      const data = await response.json() as {
        models: Array<{ name: string }>;
      };

      // Check if our specific model is pulled and ready
      return data.models?.some((m) =>
        m.name.startsWith(this.model.split(":")[0])
      ) ?? false;
    } catch {
      return false;
    }
  }
}