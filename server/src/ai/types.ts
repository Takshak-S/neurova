// All types for the AI module live here.
// Keeping them in one place means providers, prompts, services, and
// controllers all share the same contract — no type drift between layers.

// ─── Feature types ────────────────────────────────────────────────────────────

export type AIFeature = "summarize" | "reply" | "tasks";

// A single message as the client sends it — already decrypted.
// The client decrypts before calling /ai — the server never sees ciphertext here.
export interface AIMessage {
  senderId: string;
  senderName?: string; // optional — enriches context for the AI
  content: string;     // plaintext — decrypted by client before sending
  createdAt: string;   // ISO string
}

// ─── Request / Response ───────────────────────────────────────────────────────

export interface AIRequest {
  feature: AIFeature;
  messages: AIMessage[];
  conversationId: string; // for audit logging — never sent to AI provider
}

// Discriminated union — each feature has a typed response shape
export type AIResponse =
  | { feature: "summarize"; result: string }
  | { feature: "reply"; result: string[] }   // always 3 suggestions
  | { feature: "tasks"; result: string[] };  // variable length

// ─── Provider interface ───────────────────────────────────────────────────────

// Every AI provider (Groq, Ollama, future ones) must implement this interface.
// The service layer only ever calls this — never the provider directly.
// Swapping providers = changing one env variable.
export interface AIProvider {
  complete(systemPrompt: string, userPrompt: string): Promise<string>;
  isAvailable(): Promise<boolean>;
}

// ─── Internal prompt types ────────────────────────────────────────────────────

export interface PromptPair {
  system: string;
  user: string;
}