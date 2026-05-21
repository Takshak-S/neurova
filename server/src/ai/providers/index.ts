import { AIProvider } from "../types";
import { GroqProvider } from "./groq.provider";
import { OllamaProvider } from "./ollama.provider";
import { env } from "../../config/env";

// Factory function — returns the correct provider based on AI_PROVIDER env var.
// The service layer calls this once and never imports Groq or Ollama directly.
//
// Adding a new provider (Anthropic, OpenAI, etc.) means:
// 1. Create the provider class implementing AIProvider
// 2. Add a case here
// 3. Add the env var to env.ts
// Zero changes to service, controller, or route code.

let providerInstance: AIProvider | null = null;

export const getAIProvider = (): AIProvider => {
  // Singleton — instantiate once, reuse across requests.
  // Provider constructors read from env — safe to cache.
  if (providerInstance) return providerInstance;

  switch (env.ai.provider) {
    case "groq":
      providerInstance = new GroqProvider();
      break;
    case "ollama":
      providerInstance = new OllamaProvider();
      break;
    default:
      throw new Error(
        `Unknown AI provider: "${env.ai.provider}". ` +
        `Valid options: groq, ollama`
      );
  }

  console.log(`🤖 AI provider: ${env.ai.provider} (${
    env.ai.provider === "groq" ? env.ai.groq.model : env.ai.ollama.model
  })`);

  return providerInstance;
};

// Exposed for testing — allows resetting the singleton between tests
export const resetAIProvider = (): void => {
  providerInstance = null;
};