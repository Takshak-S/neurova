import { AIMessage, PromptPair } from "../types";

// Task extraction prompt engineering notes:
//
// This is the most useful feature and the most likely to hallucinate.
// The failure mode is "making up" tasks that weren't actually discussed.
//
// Mitigations:
// 1. "Only extract tasks explicitly stated" — reduces hallucination
// 2. "Do not infer" — hard constraint against assumption
// 3. Format: "Person: task" — attributing tasks prevents ambiguity
// 4. Empty array is valid — "[]" when no tasks found is correct behaviour
//
// We send the full capped conversation here (not just last N),
// because tasks can be mentioned anywhere in a long thread.

export const buildTasksPrompt = (messages: AIMessage[]): PromptPair => {
  const system = `You are a task extractor for a private messaging app.
Your job is to read a conversation and extract action items — things someone committed to doing, or was asked to do.

Rules:
- Only extract tasks that are explicitly stated in the conversation
- Do not infer, guess, or add tasks not clearly mentioned
- Format each task as: "Person: task description"
- Use the person's name if available, otherwise use "Someone"
- Include deadlines or timeframes if mentioned ("by Friday", "next week")
- If no tasks are found, return an empty array: []
- Respond ONLY with a valid JSON array of strings. No markdown, no explanation.

Example output:
["Bob: Send the report to Alice by Friday", "Alice: Book the meeting room for Tuesday", "Bob: Share the project timeline"]

Empty example:
[]`;

  const formatted = messages
    .map((m) => {
      const name = m.senderName ?? `User ${m.senderId.slice(-4)}`;
      return `${name}: ${m.content}`;
    })
    .join("\n");

  const user = `Extract all action items from this conversation:\n\n${formatted}`;

  return { system, user };
};