import { z } from "zod";

// Validates the full /ai/process request body.
// This runs before the controller — malformed requests never reach aiService.

export const aiProcessSchema = z.object({
  feature: z.enum(["summarize", "reply", "tasks"] as const, {
    message: "Invalid feature"
  }),

  conversationId: z
    .string()
    .regex(/^[a-f\d]{24}$/i, "conversationId must be a valid MongoDB ObjectId"),

  messages: z
    .array(
      z.object({
        senderId: z.string().min(1, "senderId is required"),
        senderName: z.string().optional(),
        // content is the decrypted plaintext — the client decrypts before sending
        content: z
          .string()
          .min(1, "message content cannot be empty")
          .max(10000, "message content exceeds maximum length"),
        createdAt: z.string().datetime("createdAt must be a valid ISO datetime"),
      })
    )
    .min(1, "At least one message is required")
    .max(100, "Maximum 100 messages per AI request"),
});

export type AIProcessInput = z.infer<typeof aiProcessSchema>;