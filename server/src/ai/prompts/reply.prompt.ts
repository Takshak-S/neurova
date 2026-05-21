import { AIMessage, PromptPair } from "../types";
import { env } from "../../config/env";

// Smart reply prompt engineering notes:
//
// The biggest failure mode for smart replies is tone mismatch.
// A casual "lol ok" conversation should not get "Certainly, I will attend."
// We address this by:
// 1. Explicitly instructing tone matching
// 2. Capping context to the last N messages (recency = current tone)
// 3. Requesting JSON output with strict format instructions
//
// JSON output reliability:
// We use "respond ONLY with a JSON array" + an example.
// Without the example, models often wrap the array in markdown (```json).
// With the example, they almost never do — but we still strip markdown
// in the parser as a safety net.

export const buildSmartReplyPrompt = (
  messages: AIMessage[],
  recipientName?: string
): PromptPair => {
  // Only the last N messages needed — recent context determines tone
  const capped = messages.slice(-env.ai.maxMessagesForReply);
  const lastMessage = capped[capped.length - 1];
  const recipient = recipientName ?? "the other person";

  const system = `You are a smart reply suggestion engine for a private messaging app.
Given a conversation, generate exactly 3 short reply suggestions for the user to send to ${recipient}.

Rules:
- Match the tone exactly: casual conversations get casual replies, formal gets formal
- Each reply must be between 2 and 12 words
- Replies must be distinct — do not suggest variations of the same thing
- Replies must be relevant to the last message specifically
- Do not use emojis unless the conversation already uses them
- Do not suggest replies that require information not in the conversation
- Respond ONLY with a valid JSON array of 3 strings. No markdown, no explanation.

Example output format:
["Sounds good!", "I'll be there", "Can we reschedule?"]`;

  const formatted = capped
    .map((m) => {
      const name = m.senderName ?? `User ${m.senderId.slice(-4)}`;
      return `${name}: ${m.content}`;
    })
    .join("\n");

  const user = `Conversation:\n${formatted}\n\nGenerate 3 reply suggestions for the last message.`;

  return { system, user };
};