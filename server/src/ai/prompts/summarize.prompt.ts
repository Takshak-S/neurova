import { AIMessage, PromptPair } from "../types";
import { env } from "../../config/env";

// Prompt engineering principles applied here:
//
// 1. System prompt defines the persona and hard constraints.
//    "You are X" + "You must Y" + "Never Z" — LLMs follow this reliably.
//
// 2. User prompt contains the data, never instructions.
//    Mixing instructions into the user prompt reduces reliability.
//
// 3. We cap the message count before building the prompt.
//    Sending 500 messages to an LLM wastes tokens and degrades quality.
//    The last N messages are most relevant for a summary.

export const buildSummarizePrompt = (messages: AIMessage[]): PromptPair => {
  // Take the most recent N messages — older context adds noise
  const capped = messages.slice(-env.ai.maxMessagesForSummary);

  const system = `You are a conversation summarizer for a private messaging app.
Your job is to read a conversation and produce a concise, factual summary.

Rules:
- Write 3 to 5 sentences maximum
- Be neutral and objective — do not take sides
- Focus on key topics discussed, decisions made, and action items mentioned
- Do not infer or assume anything not explicitly stated
- Do not include greetings, small talk, or filler
- Write in third person ("Alice and Bob discussed...", not "You discussed...")
- If the conversation is too short to summarize meaningfully, say so in one sentence`;

  const formatted = capped
    .map((m) => {
      const name = m.senderName ?? `User ${m.senderId.slice(-4)}`;
      const time = new Date(m.createdAt).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
      return `[${time}] ${name}: ${m.content}`;
    })
    .join("\n");

  const user = `Summarize the following conversation:\n\n${formatted}`;

  return { system, user };
};